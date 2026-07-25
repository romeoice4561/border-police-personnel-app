/**
 * Maps authenticated actor → organization / permission execution context.
 *
 * Today AuthUser has no region/battalion/company ACL fields. Directory-capable
 * actors (commander.search / officers.view / dashboard.view) receive unrestricted
 * organization scope. Officers without directory access are ownership-scoped
 * inside the Gateway via subjectOfficerId.
 *
 * Policy: out-of-scope unit filters → OUT_OF_SCOPE (403), not empty success.
 */
import { hasPermission } from "@/lib/auth/roles";
import {
  resolveAuthorizedOrgScope,
  type AuthorizedOrgScope,
} from "@/lib/personnel_intelligence_service/permissions";
import { lookupOrgByPublicCode, type OrgEntityCatalog } from "@/lib/personnel_entities/organization";
import type { PersonnelSearchApiUnitScope } from "@/lib/personnel_search_api/contracts";
import type { PersonnelSearchActor } from "@/lib/personnel_search_api/authentication";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";

export interface OrganizationScopeCodes {
  /** Null entries mean unrestricted for that level. */
  regionIds: number[] | null;
  divisionIds: number[] | null;
  companyIds: number[] | null;
  unrestricted: boolean;
}

export interface PersonnelSearchExecutionContext {
  actor: {
    userId: string;
    officerId?: string;
    role: PersonnelSearchActor["role"];
  };
  permissions: PersonnelSearchActor["permissions"];
  organizationScope: OrganizationScopeCodes;
  requestId: string;
  requestedAt: string;
}

export function buildExecutionContext(
  actor: PersonnelSearchActor,
  requestId: string,
  requestedAt: string
): PersonnelSearchExecutionContext {
  const authorized = resolveAuthorizedOrgScope(actor);
  return {
    actor: {
      userId: actor.id,
      officerId: actor.officerId ?? undefined,
      role: actor.role,
    },
    permissions: actor.permissions,
    organizationScope: fromAuthorized(authorized),
    requestId,
    requestedAt,
  };
}

function fromAuthorized(authorized: AuthorizedOrgScope): OrganizationScopeCodes {
  if (authorized.unrestricted) {
    return { regionIds: null, divisionIds: null, companyIds: null, unrestricted: true };
  }
  return {
    regionIds: authorized.regionId != null ? [authorized.regionId] : [],
    divisionIds: authorized.battalionId != null ? [authorized.battalionId] : [],
    companyIds: authorized.companyId != null ? [authorized.companyId] : [],
    unrestricted: false,
  };
}

/**
 * Validates optional request unitScope (public codes) against authorized scope.
 * Resolves public codes → internal FKs via the Entity catalog (Phase 51.1A).
 * Never treats public codes as internal ids.
 */
export function resolveEffectiveUnitFilter(
  organizationScope: OrganizationScopeCodes,
  requested: PersonnelSearchApiUnitScope | undefined,
  catalog: OrgEntityCatalog
): { regionId?: number; divisionId?: number; companyId?: number } {
  const hasRequested =
    Boolean(requested?.regionCode) || Boolean(requested?.divisionCode) || Boolean(requested?.companyCode);

  if (!organizationScope.unrestricted && hasRequested) {
    throw new PersonnelSearchApiError(
      "OUT_OF_SCOPE",
      "Requested organization scope exceeds authorized access",
      403,
      "unitScope"
    );
  }

  let regionId: number | undefined;
  let divisionId: number | undefined;
  let companyId: number | undefined;

  if (requested?.regionCode) {
    const record = lookupOrgByPublicCode(catalog, "region", requested.regionCode.trim());
    if (!record) {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "Unknown regionCode", 400, "unitScope.regionCode");
    }
    regionId = record.internalId;
  }
  if (requested?.divisionCode) {
    const record = lookupOrgByPublicCode(catalog, "division", requested.divisionCode.trim());
    if (!record) {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "Unknown divisionCode", 400, "unitScope.divisionCode");
    }
    divisionId = record.internalId;
  }
  if (requested?.companyCode) {
    const record = lookupOrgByPublicCode(catalog, "company", requested.companyCode.trim());
    if (!record) {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "Unknown companyCode", 400, "unitScope.companyCode");
    }
    companyId = record.internalId;
  }

  if (organizationScope.regionIds && regionId != null && !organizationScope.regionIds.includes(regionId)) {
    throw new PersonnelSearchApiError("OUT_OF_SCOPE", "Region is outside authorized scope", 403, "unitScope.regionCode");
  }
  if (organizationScope.divisionIds && divisionId != null && !organizationScope.divisionIds.includes(divisionId)) {
    throw new PersonnelSearchApiError("OUT_OF_SCOPE", "Division is outside authorized scope", 403, "unitScope.divisionCode");
  }
  if (organizationScope.companyIds && companyId != null && !organizationScope.companyIds.includes(companyId)) {
    throw new PersonnelSearchApiError("OUT_OF_SCOPE", "Company is outside authorized scope", 403, "unitScope.companyCode");
  }

  return { regionId, divisionId, companyId };
}

export function actorCanUsePersonnelSearchApi(actor: PersonnelSearchActor): boolean {
  return (
    hasPermission(actor.permissions, "search.view") ||
    hasPermission(actor.permissions, "commander.search") ||
    hasPermission(actor.permissions, "officers.view") ||
    hasPermission(actor.permissions, "officer.viewOwn")
  );
}
