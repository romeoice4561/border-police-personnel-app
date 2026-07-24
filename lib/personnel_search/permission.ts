/**
 * Permission filter for Personnel Search Gateway (Phase 51).
 * Results never expose fields before this layer runs.
 */
import { hasPermission, type Permission } from "@/lib/auth/roles";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PersonnelSearchEnrichment } from "@/lib/personnel_search/contracts";

export interface SearchPermissionContext {
  permissions: readonly Permission[];
  subjectOfficerId?: string | null;
}

export interface FieldAccess {
  canSearch: boolean;
  canViewDirectory: boolean;
  canViewFullProfile: boolean;
  canViewContacts: boolean;
  canViewFinancial: boolean;
  canExport: boolean;
  canOpenDashboard: boolean;
  /** Scope labels for audit / response.permissionScope. */
  scopeLabels: string[];
}

export function resolveFieldAccess(ctx: SearchPermissionContext): FieldAccess {
  const can = (p: Permission) => hasPermission(ctx.permissions, p);
  const canViewDirectory = can("officers.view") || can("commander.search");
  const canSearch = can("search.view") || canViewDirectory || can("officer.viewOwn");
  const canViewContacts = canViewDirectory; // phones only when directory-capable
  const canViewFinancial = can("officers.viewFinancial");
  const canExport = can("documents.download") || can("commander.search");
  const canOpenDashboard = can("dashboard.view");
  const canViewFullProfile = canViewDirectory;

  const scopeLabels: string[] = [];
  if (canSearch) scopeLabels.push("search");
  if (canViewDirectory) scopeLabels.push("directory");
  if (canViewContacts) scopeLabels.push("contacts");
  if (canViewFinancial) scopeLabels.push("financial");
  if (canExport) scopeLabels.push("export");
  if (can("officer.viewOwn")) scopeLabels.push("own_profile");

  return {
    canSearch,
    canViewDirectory,
    canViewFullProfile,
    canViewContacts,
    canViewFinancial,
    canExport,
    canOpenDashboard,
    scopeLabels,
  };
}

export function isOwnOfficer(ctx: SearchPermissionContext, officerId: string): boolean {
  return Boolean(ctx.subjectOfficerId && ctx.subjectOfficerId === officerId);
}

/** Mask police / business id — never return the full id to unauthorized viewers. */
export function maskOfficerId(officerId: string, reveal: boolean): string {
  if (reveal) return officerId;
  const parts = officerId.split("/");
  if (parts.length === 2) {
    const left = parts[0];
    const right = parts[1];
    const leftMask = left.length <= 2 ? "*" : `${left.slice(0, 1)}***`;
    const rightMask = right.length <= 1 ? "*" : `*${right.slice(-1)}`;
    return `${leftMask}/${rightMask}`;
  }
  if (officerId.length <= 3) return "***";
  return `${officerId.slice(0, 1)}***${officerId.slice(-1)}`;
}

export function canRevealOfficerId(access: FieldAccess, ctx: SearchPermissionContext, officerId: string): boolean {
  return access.canViewDirectory || isOwnOfficer(ctx, officerId);
}

export function filterContactEnrichment(
  enrichment: PersonnelSearchEnrichment,
  access: FieldAccess,
  ctx: SearchPermissionContext,
  officerId: string
): PersonnelSearchEnrichment {
  if (access.canViewContacts || isOwnOfficer(ctx, officerId)) return enrichment;
  return { ...enrichment, phones: undefined, dutyPhone: undefined };
}

/** Officers an ownership-scoped principal may see when lacking directory access. */
export function filterOfficersForPrincipal(
  officers: CommanderQueryOfficer[],
  access: FieldAccess,
  ctx: SearchPermissionContext
): CommanderQueryOfficer[] {
  if (access.canViewDirectory) return officers;
  if (ctx.subjectOfficerId) {
    return officers.filter((o) => o.officerId === ctx.subjectOfficerId);
  }
  return [];
}
