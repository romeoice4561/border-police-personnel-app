/**
 * Timeline work-line ("สายงาน") options — Phase 49A.3.
 * Combobox suggestions; custom values are always allowed and persisted verbatim.
 */

export const WORK_LINE_OPTIONS = [
  "งานอำนวยการ",
  "งานจราจร",
  "งานป้องกันปราบปราม",
  "งานสืบสวน",
  "งานสอบสวน",
] as const;

export type WorkLineOption = (typeof WORK_LINE_OPTIONS)[number];
