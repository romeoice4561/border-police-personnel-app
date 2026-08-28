/**
 * Removable filter chips (Phase DI-8.2, Section 5).
 *
 * Derives one human-readable chip per ACTIVE, user-set filter from the
 * existing DrugGeoFilterState — never a parallel filter representation.
 * personId/caseId are deliberately excluded: those are deep-link
 * navigation context (Map opened FROM a Person/Case), not a filter the
 * user picked from this panel, so they get their own existing banner
 * (di.map.personDeepLinkNotice) rather than a removable chip here.
 *
 * Clearing an org-hierarchy chip clears its WHOLE branch (e.g. removing
 * the "กองกำกับการ" chip also clears the now-incompatible "กองร้อย"), never
 * leaving a company id whose parent battalion no longer matches — mirrors
 * the cascading-clear convention this phase's Section 5 calls out
 * (DI-7.4.2 dependent-org-clearing).
 *
 * Pure — no I/O, no React.
 */

import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CATEGORY_LABELS, isValidDrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";

export interface DrugGeoFilterChip {
  key: string;
  label: string;
  /** Patch to apply (via the page's existing applyFilters) to remove exactly this filter — and, for org levels, its dependent children. */
  clearPatch: Partial<DrugGeoFilterState>;
}

const REPORTING_ORG_CLEAR: Partial<DrugGeoFilterState> = {
  headquartersId: null,
  headquartersText: "",
  regionId: null,
  regionText: "",
  battalionId: null,
  battalionText: "",
  companyId: null,
  companyText: "",
};
const LEAD_ORG_CLEAR: Partial<DrugGeoFilterState> = {
  leadHeadquartersId: null,
  leadHeadquartersText: "",
  leadRegionId: null,
  leadRegionText: "",
  leadBattalionId: null,
  leadBattalionText: "",
  leadCompanyId: null,
  leadCompanyText: "",
};

function statusLabelTh(status: string): string {
  return isValidDrugCaseStatus(status) ? DRUG_CASE_STATUS_META[status].labelTh : status;
}

function drugCategoryLabelTh(category: string): string {
  return isValidDrugCategory(category) ? DRUG_CATEGORY_LABELS[category].labelTh : category;
}

/**
 * Reads the MOST SPECIFIC populated level of an org branch for the chip
 * label — "กองร้อย: X" when a company is set, else "กองกำกับการ: X" when only
 * battalion is set, etc. — NEVER a raw numeric id (Section 5's explicit
 * rule). Prefers the filter state's own *Text (kept fresh once the user has
 * interacted with OrgHierarchyPicker); when that's blank — e.g. right after
 * loading a URL that only carries an *Id, before the picker has resolved a
 * label — falls back to organizationEngine.resolveLabels(), which never
 * invents a label for an unresolved id. If NEITHER source has a label yet
 * (engine still loading), the chip is omitted rather than ever showing a
 * bare id or a blank chip.
 */
function orgBranchLabel(
  branchLabelPrefix: string,
  ids: { companyId: number | null; companyText: string; battalionId: number | null; battalionText: string; regionId: number | null; regionText: string; headquartersId: number | null; headquartersText: string },
  organizationEngine: OrganizationEngine | undefined
): string | null {
  const resolved = organizationEngine?.resolveLabels({
    headquartersId: ids.headquartersId,
    regionId: ids.regionId,
    battalionId: ids.battalionId,
    companyId: ids.companyId,
  });

  if (ids.companyId !== null) {
    const label = ids.companyText || resolved?.company;
    return label ? `${branchLabelPrefix} (${"กองร้อย"}): ${label}` : null;
  }
  if (ids.battalionId !== null) {
    const label = ids.battalionText || resolved?.battalion;
    return label ? `${branchLabelPrefix} (${"กองกำกับการ"}): ${label}` : null;
  }
  if (ids.regionId !== null) {
    const label = ids.regionText || resolved?.borderPatrolDivision;
    return label ? `${branchLabelPrefix} (${"กองบังคับการ"}): ${label}` : null;
  }
  if (ids.headquartersId !== null) {
    const label = ids.headquartersText || resolved?.headquarters;
    return label ? `${branchLabelPrefix}: ${label}` : null;
  }
  return null;
}

export function deriveDrugGeoFilterChips(filters: DrugGeoFilterState, organizationEngine?: OrganizationEngine): DrugGeoFilterChip[] {
  const chips: DrugGeoFilterChip[] = [];

  if (filters.dateFrom || filters.dateTo) {
    const label = filters.dateFrom && filters.dateTo ? `ช่วงเวลา: ${filters.dateFrom} – ${filters.dateTo}` : filters.dateFrom ? `ตั้งแต่: ${filters.dateFrom}` : `ถึง: ${filters.dateTo}`;
    chips.push({ key: "date", label, clearPatch: { dateFrom: "", dateTo: "" } });
  }
  if (filters.province) {
    chips.push({ key: "province", label: `จังหวัด: ${filters.province}`, clearPatch: { province: "" } });
  }
  if (filters.district) {
    chips.push({ key: "district", label: `อำเภอ: ${filters.district}`, clearPatch: { district: "" } });
  }
  if (filters.status) {
    chips.push({ key: "status", label: `สถานะคดี: ${statusLabelTh(filters.status)}`, clearPatch: { status: "" } });
  }
  if (filters.drugCategory) {
    chips.push({ key: "drugCategory", label: `ประเภทยา: ${drugCategoryLabelTh(filters.drugCategory)}`, clearPatch: { drugCategory: "" } });
  }

  const reportingLabel = orgBranchLabel("หน่วยรายงาน", filters, organizationEngine);
  if (reportingLabel) {
    chips.push({ key: "reportingOrg", label: reportingLabel, clearPatch: REPORTING_ORG_CLEAR });
  }

  const leadLabel = orgBranchLabel(
    "หน่วยจับกุมหลัก",
    {
      companyId: filters.leadCompanyId,
      companyText: filters.leadCompanyText,
      battalionId: filters.leadBattalionId,
      battalionText: filters.leadBattalionText,
      regionId: filters.leadRegionId,
      regionText: filters.leadRegionText,
      headquartersId: filters.leadHeadquartersId,
      headquartersText: filters.leadHeadquartersText,
    },
    organizationEngine
  );
  if (leadLabel) {
    chips.push({ key: "leadOrg", label: leadLabel, clearPatch: LEAD_ORG_CLEAR });
  }

  return chips;
}
