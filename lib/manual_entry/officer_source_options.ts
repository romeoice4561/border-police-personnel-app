/**
 * Officer.source options (Phase XX — Manual Personnel Entry, Admin Only).
 *
 * A closed 2-value set: "import" (the existing Drive/AI pipeline — every
 * pre-existing officer, via the column's DB default) or "manual" (created
 * through the new Create Personnel form). Mirrors VERIFICATION_STATUS_META's
 * bilingual-label + color-token mapping pattern exactly.
 *
 * Pure data — no I/O, no React.
 */

export const OFFICER_SOURCE_OPTIONS = ["import", "manual"] as const;
export type OfficerSource = (typeof OFFICER_SOURCE_OPTIONS)[number];

export const OFFICER_SOURCE_META: Record<OfficerSource, { labelTh: string; labelEn: string; color: "warning" | "neutral" }> = {
  manual: { labelTh: "กรอกข้อมูลเอง", labelEn: "Manual Entry", color: "warning" },
  import: { labelTh: "นำเข้าอัตโนมัติ", labelEn: "AI / Drive Import", color: "neutral" },
};

export function isValidOfficerSource(value: string): value is OfficerSource {
  return (OFFICER_SOURCE_OPTIONS as readonly string[]).includes(value);
}
