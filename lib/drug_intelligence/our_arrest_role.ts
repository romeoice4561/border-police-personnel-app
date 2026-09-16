/**
 * UI-only mapping for "บทบาทของหน่วยเราในการจับกุมครั้งนี้".
 *
 * This is NOT a persisted DrugCase column. It only drives whether the
 * existing `sameAsReportingUnit` convenience copies reporting → lead, or
 * whether the operator must pick a distinct lead arrest unit.
 */

import type { CreateCaseDraft } from "@/lib/drug_intelligence/create_case_draft";

export const OUR_ARREST_ROLES = ["LEAD", "SUPPORTING"] as const;
export type OurArrestRole = (typeof OUR_ARREST_ROLES)[number] | "";

export function patchForOurArrestRole(role: OurArrestRole): Pick<CreateCaseDraft, "ourArrestRole" | "sameAsReportingUnit"> {
  if (role === "LEAD") return { ourArrestRole: "LEAD", sameAsReportingUnit: true };
  if (role === "SUPPORTING") return { ourArrestRole: "SUPPORTING", sameAsReportingUnit: false };
  return { ourArrestRole: "", sameAsReportingUnit: false };
}

export function reportingUnitDisplayText(draft: Pick<
  CreateCaseDraft,
  "useManualUnit" | "manualUnitText" | "companyText" | "battalionText" | "regionText" | "headquartersText"
>): string | null {
  return draft.useManualUnit
    ? draft.manualUnitText.trim() || null
    : draft.companyText || draft.battalionText || draft.regionText || draft.headquartersText || null;
}

export function leadUnitDisplayText(draft: Pick<
  CreateCaseDraft,
  | "sameAsReportingUnit"
  | "useManualUnit"
  | "manualUnitText"
  | "companyText"
  | "battalionText"
  | "regionText"
  | "headquartersText"
  | "useLeadManualUnit"
  | "leadManualUnitText"
  | "leadCompanyText"
  | "leadBattalionText"
  | "leadRegionText"
  | "leadHeadquartersText"
>): string | null {
  if (draft.sameAsReportingUnit) return reportingUnitDisplayText(draft);
  return draft.useLeadManualUnit
    ? draft.leadManualUnitText.trim() || null
    : draft.leadCompanyText || draft.leadBattalionText || draft.leadRegionText || draft.leadHeadquartersText || null;
}
