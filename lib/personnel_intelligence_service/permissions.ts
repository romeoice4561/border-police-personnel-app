/**
 * Capability mapping for Personnel Intelligence Service (Phase 49.5).
 *
 * Maps logical intelligence capabilities onto EXISTING project permissions —
 * no new auth framework. Pure.
 */
import type { AuthUser } from "@/lib/auth/types";
import { hasPermission, type Permission } from "@/lib/auth/roles";
import { PersonnelIntelligenceError } from "@/lib/personnel_intelligence_service/errors";

/** Logical capabilities exposed by the facade (not stored in ROLE_PERMISSIONS). */
export type IntelligenceCapability =
  | "intelligence.summary.view"
  | "intelligence.officers.search"
  | "intelligence.officer.view"
  | "intelligence.reports.view";

/** Existing permission(s) that satisfy each intelligence capability. */
const CAPABILITY_TO_PERMISSIONS: Record<IntelligenceCapability, readonly Permission[]> = {
  "intelligence.summary.view": ["dashboard.view"],
  "intelligence.officers.search": ["commander.search", "officers.view"],
  "intelligence.officer.view": ["officers.view", "officer.viewOwn"],
  "intelligence.reports.view": ["dashboard.view"],
};

export interface IntelligenceActor {
  id: string;
  username: string;
  displayName: string;
  role: AuthUser["role"];
  permissions: readonly Permission[];
  officerId: string | null;
}

export function actorFromAuthUser(user: AuthUser): IntelligenceActor {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    permissions: user.permissions,
    officerId: user.officerId,
  };
}

export function actorHasCapability(actor: IntelligenceActor, capability: IntelligenceCapability): boolean {
  const required = CAPABILITY_TO_PERMISSIONS[capability];
  return required.some((permission) => hasPermission(actor.permissions, permission));
}

export function assertCapability(actor: IntelligenceActor, capability: IntelligenceCapability): void {
  if (!actorHasCapability(actor, capability)) {
    throw new PersonnelIntelligenceError("FORBIDDEN", `Missing capability: ${capability}`);
  }
}

/**
 * Officer detail access: commanders/admins with officers.view may view any;
 * officers may view only their own linked officerId (officer.viewOwn).
 */
export function assertCanViewOfficer(actor: IntelligenceActor, officerId: string): void {
  if (hasPermission(actor.permissions, "officers.view")) return;
  if (hasPermission(actor.permissions, "officer.viewOwn") && actor.officerId === officerId) return;
  throw new PersonnelIntelligenceError("FORBIDDEN", "Not allowed to view this officer's intelligence");
}

/**
 * Organization scope for this actor. Today AuthUser has no region/battalion
 * limits — commanders/admins with dashboard.view get unrestricted scope;
 * officers get no aggregate scope (search/summary denied via capabilities).
 */
export interface AuthorizedOrgScope {
  /** Null means unrestricted (all organizations). */
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  unrestricted: boolean;
}

export function resolveAuthorizedOrgScope(actor: IntelligenceActor): AuthorizedOrgScope {
  if (actorHasCapability(actor, "intelligence.summary.view") || actorHasCapability(actor, "intelligence.officers.search")) {
    return { regionId: null, battalionId: null, companyId: null, unrestricted: true };
  }
  return { regionId: null, battalionId: null, companyId: null, unrestricted: false };
}

/** Rejects requested scope that exceeds the actor's authorized scope. */
export function assertScopeAllowed(
  authorized: AuthorizedOrgScope,
  requested: { regionId?: number; battalionId?: number; companyId?: number }
): void {
  if (authorized.unrestricted) return;
  if (requested.regionId != null || requested.battalionId != null || requested.companyId != null) {
    throw new PersonnelIntelligenceError("INVALID_SCOPE", "Organization scope exceeds authorized access");
  }
}
