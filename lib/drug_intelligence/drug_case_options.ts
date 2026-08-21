/**
 * DrugCase.status options (Phase DI-1 — Section 4/16).
 *
 * A closed set (real Postgres enum — see the schema's DrugCaseStatus doc
 * comment for why this one, unlike Rank/Position, is a true closed
 * vocabulary). Bilingual label + color-token mapping, mirroring
 * VERIFICATION_STATUS_META / OFFICER_SOURCE_META's established pattern.
 *
 * Pure data — no I/O, no React.
 */

export const DRUG_CASE_STATUSES = ["OPEN", "UNDER_INVESTIGATION", "CLOSED", "ARCHIVED"] as const;
export type DrugCaseStatus = (typeof DRUG_CASE_STATUSES)[number];

export const DRUG_CASE_STATUS_META: Record<DrugCaseStatus, { labelTh: string; labelEn: string; color: "good" | "warning" | "serious" | "neutral" | "accent" }> = {
  OPEN: { labelTh: "เปิดคดี", labelEn: "Open", color: "accent" },
  UNDER_INVESTIGATION: { labelTh: "อยู่ระหว่างสอบสวน", labelEn: "Under Investigation", color: "warning" },
  CLOSED: { labelTh: "ปิดคดี", labelEn: "Closed", color: "good" },
  ARCHIVED: { labelTh: "จัดเก็บถาวร", labelEn: "Archived", color: "neutral" },
};

export function isValidDrugCaseStatus(value: string): value is DrugCaseStatus {
  return (DRUG_CASE_STATUSES as readonly string[]).includes(value);
}
