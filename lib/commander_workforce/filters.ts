/**
 * Shared filter model for Workforce Intelligence (Phase 52.1).
 * Deterministic normalize + apply — never mutates source officers.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import {
  EMPTY_WORKFORCE_FILTERS,
  WORKFORCE_PROMOTION_STATUSES,
  WORKFORCE_RETIREMENT_WINDOWS,
} from "@/lib/commander_workforce/contracts";
import { resolveOfficerPublicOrg } from "@/lib/commander_workforce/org";
import type {
  WorkforceAvailableFilters,
  WorkforceFilterOption,
  WorkforceFilterState,
  WorkforceOrgPublicIndex,
  WorkforceRetirementWindowKey,
} from "@/lib/commander_workforce/types";
import { retirementWindowForOfficer } from "@/lib/commander_workforce/retirement";
import { documentStatusForOfficer } from "@/lib/commander_workforce/documents";
import { dataQualityStatusForOfficer } from "@/lib/commander_workforce/data_quality";

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

export function normalizeWorkforceFilters(
  partial: Partial<WorkforceFilterState> | undefined
): WorkforceFilterState {
  const base = { ...EMPTY_WORKFORCE_FILTERS };
  if (!partial) return base;

  const promotion = clean(partial.promotionStatus);
  const retirement = clean(partial.retirementWindow);
  const training = clean(partial.trainingStatus);

  return {
    regionPublicCode: clean(partial.regionPublicCode),
    divisionPublicCode: clean(partial.divisionPublicCode),
    companyPublicCode: clean(partial.companyPublicCode),
    rank: clean(partial.rank),
    positionLevel: clean(partial.positionLevel),
    promotionStatus:
      promotion && (WORKFORCE_PROMOTION_STATUSES as readonly string[]).includes(promotion)
        ? promotion
        : null,
    retirementWindow:
      retirement && (WORKFORCE_RETIREMENT_WINDOWS as readonly string[]).includes(retirement)
        ? retirement
        : null,
    trainingStatus: training,
    documentStatus: clean(partial.documentStatus),
    dataQualityStatus: clean(partial.dataQualityStatus),
    search: clean(partial.search),
  };
}

export function applyWorkforceFilters(
  officers: readonly CommanderQueryOfficer[],
  filters: WorkforceFilterState,
  orgPublicIndex: WorkforceOrgPublicIndex | undefined,
  asOf: Date
): CommanderQueryOfficer[] {
  const search = filters.search?.toLowerCase() ?? null;

  return officers.filter((officer) => {
    const org = resolveOfficerPublicOrg(officer, orgPublicIndex);

    if (filters.regionPublicCode && org.regionPublicCode !== filters.regionPublicCode) return false;
    if (filters.divisionPublicCode && org.divisionPublicCode !== filters.divisionPublicCode) {
      return false;
    }
    if (filters.companyPublicCode && org.companyPublicCode !== filters.companyPublicCode) {
      return false;
    }
    if (filters.rank && officer.rank !== filters.rank) return false;
    if (filters.positionLevel && (officer.positionLevel ?? "Unknown") !== filters.positionLevel) {
      return false;
    }

    const promo = officer.promotionIntelligence?.promotionStatus ?? "Unknown";
    if (filters.promotionStatus && promo !== filters.promotionStatus) return false;

    if (filters.retirementWindow) {
      const window = retirementWindowForOfficer(officer, asOf);
      if (window !== filters.retirementWindow) return false;
    }

    const training = officer.trainingIntelligence?.trainingStatus ?? "Unknown";
    if (filters.trainingStatus && training !== filters.trainingStatus) return false;

    if (filters.documentStatus) {
      if (documentStatusForOfficer(officer) !== filters.documentStatus) return false;
    }

    if (filters.dataQualityStatus) {
      if (dataQualityStatusForOfficer(officer) !== filters.dataQualityStatus) return false;
    }

    if (search) {
      const hay = [
        officer.displayName,
        officer.rank,
        officer.officerId,
        officer.currentPosition ?? "",
        officer.companyLabel,
        officer.currentUnit ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }

    return true;
  });
}

function optionMapToList(map: Map<string, number>, labels?: Readonly<Record<string, string>>): WorkforceFilterOption[] {
  return [...map.entries()]
    .map(([value, count]) => ({
      value,
      labelTh: labels?.[value] ?? value,
      count,
    }))
    .sort((a, b) => a.labelTh.localeCompare(b.labelTh, "th") || a.value.localeCompare(b.value));
}

export function buildAvailableFilters(
  officers: readonly CommanderQueryOfficer[],
  orgPublicIndex: WorkforceOrgPublicIndex | undefined,
  asOf: Date
): WorkforceAvailableFilters {
  const regions = new Map<string, number>();
  const divisions = new Map<string, number>();
  const companies = new Map<string, number>();
  const ranks = new Map<string, number>();
  const levels = new Map<string, number>();
  const promo = new Map<string, number>();
  const retire = new Map<string, number>();
  const training = new Map<string, number>();
  const docs = new Map<string, number>();
  const dq = new Map<string, number>();

  for (const officer of officers) {
    const org = resolveOfficerPublicOrg(officer, orgPublicIndex);
    if (org.regionPublicCode) regions.set(org.regionPublicCode, (regions.get(org.regionPublicCode) ?? 0) + 1);
    if (org.divisionPublicCode) {
      divisions.set(org.divisionPublicCode, (divisions.get(org.divisionPublicCode) ?? 0) + 1);
    }
    if (org.companyPublicCode) {
      companies.set(org.companyPublicCode, (companies.get(org.companyPublicCode) ?? 0) + 1);
    }
    if (officer.rank) ranks.set(officer.rank, (ranks.get(officer.rank) ?? 0) + 1);
    const level = officer.positionLevel ?? "Unknown";
    levels.set(level, (levels.get(level) ?? 0) + 1);

    const p = officer.promotionIntelligence?.promotionStatus ?? "Unknown";
    promo.set(p, (promo.get(p) ?? 0) + 1);

    const w = retirementWindowForOfficer(officer, asOf) as WorkforceRetirementWindowKey;
    retire.set(w, (retire.get(w) ?? 0) + 1);

    const t = officer.trainingIntelligence?.trainingStatus ?? "Unknown";
    training.set(t, (training.get(t) ?? 0) + 1);

    const d = documentStatusForOfficer(officer);
    docs.set(d, (docs.get(d) ?? 0) + 1);

    const q = dataQualityStatusForOfficer(officer);
    dq.set(q, (dq.get(q) ?? 0) + 1);
  }

  return {
    regions: optionMapToList(regions, orgPublicIndex?.regionLabelByCode),
    divisions: optionMapToList(divisions, orgPublicIndex?.divisionLabelByCode),
    companies: optionMapToList(companies, orgPublicIndex?.companyLabelByCode),
    ranks: optionMapToList(ranks),
    positionLevels: optionMapToList(levels),
    promotionStatuses: optionMapToList(promo),
    retirementWindows: optionMapToList(retire),
    trainingStatuses: optionMapToList(training),
    documentStatuses: optionMapToList(docs),
    dataQualityStatuses: optionMapToList(dq),
  };
}
