/**
 * Career Timeline "ที่มาของข้อมูล" (Source) and "สถานะ" (Verified) options
 * (Phase 23A — Officer Profile Workspace, Section 2).
 *
 * Both fields are dropdowns, not free text. Shared between the Zod schema
 * (server) and the Select controls (client).
 *
 * Pure data — no I/O, no React.
 */

/** Where a timeline row's data came from. */
export const TIMELINE_SOURCE_OPTIONS = ["OCR", "Import", "AI", "เจ้าหน้าที่กรอก", "เจ้าตัวกรอก", "ตรวจสอบแล้ว"] as const;
export type TimelineSource = (typeof TIMELINE_SOURCE_OPTIONS)[number];

/** The review/verification status of a timeline row. */
export const TIMELINE_VERIFIED_OPTIONS = ["ยังไม่ตรวจ", "ตรวจแล้ว", "ยืนยันแล้ว"] as const;
export type TimelineVerifiedStatus = (typeof TIMELINE_VERIFIED_OPTIONS)[number];

const SOURCE_SET = new Set<string>(TIMELINE_SOURCE_OPTIONS);
const VERIFIED_SET = new Set<string>(TIMELINE_VERIFIED_OPTIONS);

export function isValidTimelineSource(value: string): boolean {
  return SOURCE_SET.has(value);
}

export function isValidTimelineVerifiedStatus(value: string): boolean {
  return VERIFIED_SET.has(value);
}
