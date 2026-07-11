/**
 * Blood group options (Phase 26B Part 5 Part G/L — Personal Information).
 *
 * Offered as Select suggestions; "ไม่ระบุ" (Unknown) is a genuine value
 * (not a placeholder) so a record can explicitly record "not known" versus
 * simply being unset. Reusable master dataset — not hardcoded in components.
 *
 * Pure data — no I/O, no React.
 */

export const BLOOD_GROUP_OPTIONS = ["A", "B", "AB", "O", "ไม่ระบุ"] as const;
export type BloodGroup = (typeof BLOOD_GROUP_OPTIONS)[number];
