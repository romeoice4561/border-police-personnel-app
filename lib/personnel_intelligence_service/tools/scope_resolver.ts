/**
 * Organization scope enforcement for tool execution (Phase 49.6).
 *
 * Retains Phase 49.5 limitation: AuthUser has no per-region ACL yet —
 * authorized commanders are unrestricted; officers have no aggregate scope.
 */
import {
  assertScopeAllowed,
  resolveAuthorizedOrgScope,
  type AuthorizedOrgScope,
  type IntelligenceActor,
} from "@/lib/personnel_intelligence_service/permissions";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import type { IntelligenceScope } from "@/lib/personnel_intelligence_service/types";

export interface EffectiveToolScope {
  authorized: AuthorizedOrgScope;
  requested: IntelligenceScope;
  effective: IntelligenceScope;
}

function extractRequestedScope(input: unknown): IntelligenceScope {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const scope: IntelligenceScope = {};
  for (const key of ["regionId", "battalionId", "companyId"] as const) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new IntelligenceToolError("INVALID_SCOPE", `Invalid ${key}`);
    }
    scope[key] = n;
  }
  return scope;
}

/**
 * Resolves and enforces organization scope for a tool call.
 * Requested scope must be equal to or narrower than authorized scope.
 */
export function resolveIntelligenceToolScope(
  actor: IntelligenceActor,
  input: unknown
): EffectiveToolScope {
  const authorized = resolveAuthorizedOrgScope(actor);
  const requested = extractRequestedScope(input);
  try {
    assertScopeAllowed(authorized, requested);
  } catch {
    throw new IntelligenceToolError("INVALID_SCOPE", "Organization scope exceeds authorized access");
  }

  // Unrestricted actors: effective = requested (or empty = full permitted scope).
  // Restricted actors (no aggregate ACL today): must not request org scope.
  const effective: IntelligenceScope = { ...requested };
  if (!authorized.unrestricted) {
    if (requested.regionId != null || requested.battalionId != null || requested.companyId != null) {
      throw new IntelligenceToolError("INVALID_SCOPE", "Organization scope exceeds authorized access");
    }
  }

  return { authorized, requested, effective };
}

export function summarizeScope(authorized: AuthorizedOrgScope, requested: IntelligenceScope): string {
  if (authorized.unrestricted) {
    const parts = [
      requested.regionId != null ? `region:${requested.regionId}` : null,
      requested.battalionId != null ? `battalion:${requested.battalionId}` : null,
      requested.companyId != null ? `company:${requested.companyId}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? `unrestricted/${parts.join(",")}` : "unrestricted";
  }
  return "restricted";
}
