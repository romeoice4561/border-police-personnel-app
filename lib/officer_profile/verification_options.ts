/**
 * Timeline verification status + "Verified By" options (Phase 26B Part 5
 * Part D/H/L).
 *
 * `TIMELINE_VERIFICATION_STATUS_OPTIONS` is a NEW, distinct 4-value closed
 * set (VERIFIED/PENDING/REJECTED/NEEDS_REVIEW) stored in
 * Timeline.verificationStatus — additive alongside the EXISTING 3-value
 * `verified` free-text status (ยังไม่ตรวจ/ตรวจแล้ว/ยืนยันแล้ว, unchanged, see
 * timeline_status_options.ts). A true closed set (Select, not Combobox):
 * Part H specifies exactly 4 states with fixed colors, so — unlike Rank/
 * Position/Unit — there is no "preserve free-form legacy value" concern
 * here; every row's verificationStatus starts unset (null) and is only ever
 * set through this new UI.
 *
 * `VERIFIED_BY_OPTIONS` (Part H) IS a Combobox suggestion list — "Custom
 * values allowed" per spec — mirroring Rank/Position/Unit's convention.
 *
 * Pure data — no I/O, no React.
 */

export const TIMELINE_VERIFICATION_STATUS_OPTIONS = ["VERIFIED", "PENDING", "REJECTED", "NEEDS_REVIEW"] as const;
export type TimelineVerificationStatus = (typeof TIMELINE_VERIFICATION_STATUS_OPTIONS)[number];

/**
 * Thai/English bilingual label + color token per status (Part H: Verified=
 * Green, Pending=Orange, Rejected=Red, Needs Review=Blue). Mapped to this
 * codebase's existing color tokens (app/globals.css) — `serious` is the
 * existing orange token (not `warning`, which is amber) and `accent` is the
 * existing blue token (there is no separate "info" token).
 */
export const VERIFICATION_STATUS_META: Record<TimelineVerificationStatus, { labelTh: string; labelEn: string; color: "good" | "serious" | "critical" | "accent" }> = {
  VERIFIED: { labelTh: "ตรวจแล้ว", labelEn: "Verified", color: "good" },
  PENDING: { labelTh: "รอตรวจสอบ", labelEn: "Pending", color: "serious" },
  REJECTED: { labelTh: "ปฏิเสธ", labelEn: "Rejected", color: "critical" },
  NEEDS_REVIEW: { labelTh: "ต้องทบทวน", labelEn: "Needs Review", color: "accent" },
};

const VERIFICATION_STATUS_SET = new Set<string>(TIMELINE_VERIFICATION_STATUS_OPTIONS);

export function isValidTimelineVerificationStatus(value: string): value is TimelineVerificationStatus {
  return VERIFICATION_STATUS_SET.has(value);
}

/** Who verified a timeline row — a Combobox suggestion list, custom values allowed. */
export const VERIFIED_BY_OPTIONS = ["Admin", "เจ้าหน้าที่กำลังพล", "กำลังพล", "ผู้บังคับบัญชา", "เจ้าของข้อมูล"] as const;
