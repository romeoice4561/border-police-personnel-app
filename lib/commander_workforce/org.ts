/**
 * Organization public-code helpers for Workforce ViewModel (Phase 52.1).
 * Never exposes internal FKs in ViewModel output.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { WorkforceOrgPublicIndex } from "@/lib/commander_workforce/types";

export interface OfficerPublicOrg {
  regionPublicCode: string | null;
  divisionPublicCode: string | null;
  companyPublicCode: string | null;
}

export function resolveOfficerPublicOrg(
  officer: CommanderQueryOfficer,
  index: WorkforceOrgPublicIndex | undefined
): OfficerPublicOrg {
  if (!index) {
    return { regionPublicCode: null, divisionPublicCode: null, companyPublicCode: null };
  }
  return {
    regionPublicCode:
      officer.regionId != null ? index.regionById[String(officer.regionId)] ?? null : null,
    divisionPublicCode:
      officer.battalionId != null ? index.divisionById[String(officer.battalionId)] ?? null : null,
    companyPublicCode:
      officer.companyId != null ? index.companyById[String(officer.companyId)] ?? null : null,
  };
}

export function orgPublicCodesAvailable(index: WorkforceOrgPublicIndex | undefined): boolean {
  if (!index) return false;
  return (
    Object.keys(index.regionById).length > 0 ||
    Object.keys(index.divisionById).length > 0 ||
    Object.keys(index.companyById).length > 0
  );
}
