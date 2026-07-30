/**
 * Employment status (สถานะรับราชการ) options (Phase XX — Manual Personnel
 * Entry, Admin Only, Section 3).
 *
 * Free-form TEXT (Officer.employmentStatus), not a DB enum — Combobox
 * suggestions only, matching Rank/Position/Unit's established "curated-
 * suggestion, never a closed set" convention throughout this module.
 *
 * Pure data — no I/O, no React.
 */

export const EMPLOYMENT_STATUS_OPTIONS: readonly string[] = [
  "ปฏิบัติราชการ",
  "ลาศึกษาต่อ",
  "ช่วยราชการ",
  "พักราชการ",
  "ลาออก",
  "เกษียณอายุราชการ",
  "เสียชีวิต",
  "ให้ออกจากราชการ",
];
