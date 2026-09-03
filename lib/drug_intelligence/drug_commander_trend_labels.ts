/**
 * Commander trend month labels (Phase 2B.2.1).
 *
 * Thai abbreviations must stay the full conventional forms (ต.ค., พ.ย., …)
 * — never single-letter. FY display order is Oct → Sep.
 * Pure — no I/O, no React.
 */

export const COMMANDER_MONTH_LABEL_TH = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export const COMMANDER_MONTH_LABEL_EN = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Thai FY month order: October through September. */
export const COMMANDER_FY_MONTH_LABELS_TH = [
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
] as const;

export function commanderMonthLabel(month: number, language: string): string {
  if (month < 1 || month > 12) return "";
  return language === "th" ? COMMANDER_MONTH_LABEL_TH[month] : COMMANDER_MONTH_LABEL_EN[month];
}
