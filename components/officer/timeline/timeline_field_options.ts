/**
 * Shared Timeline field <Select> option lists (Phase 45).
 *
 * Extracted from the former inline definitions in career_timeline_editor.tsx so
 * the refactored TimelineCard and the editor share ONE source (no duplicated
 * option arrays). Pure data — values/labels are identical to before; only their
 * location changed. No business logic.
 */

import { POSITION_LEVELS } from "@/lib/commander_query/position_level";
import { MONTH_OPTIONS, YEAR_BE_OPTIONS } from "@/lib/officer_profile/thai_date";
import { TIMELINE_VERIFICATION_STATUS_OPTIONS, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";

/** ระดับตำแหน่ง (structured, closed set). "Unknown" shows as "— ไม่ระบุ —". */
export const POSITION_LEVEL_SELECT_OPTIONS = POSITION_LEVELS.map((level) => ({
  value: level,
  label: level === "Unknown" ? "— ไม่ระบุ / Unknown —" : level,
}));

/** สถานะการตรวจสอบ — the 4-value closed set, with an unset placeholder. */
export const VERIFICATION_STATUS_SELECT_OPTIONS = [
  { value: "", label: "— ยังไม่ระบุ —" },
  ...TIMELINE_VERIFICATION_STATUS_OPTIONS.map((v) => ({
    value: v,
    label: `${VERIFICATION_STATUS_META[v].labelTh} / ${VERIFICATION_STATUS_META[v].labelEn}`,
  })),
];

export const DAY_SELECT_OPTIONS = [
  { value: "", label: "วัน" },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];

export const MONTH_SELECT_OPTIONS = [{ value: "", label: "เดือน" }, ...MONTH_OPTIONS.map((m) => ({ value: String(m.value), label: m.label }))];

export const YEAR_BE_SELECT_OPTIONS = [{ value: "", label: "พ.ศ." }, ...YEAR_BE_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))];
