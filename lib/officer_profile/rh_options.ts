/**
 * Rh factor options (Phase 26B Part 5 Part G/L — Personal Information).
 *
 * Pure data — no I/O, no React.
 */

export const RH_OPTIONS = ["Rh+", "Rh-", "ไม่ระบุ"] as const;
export type RhFactor = (typeof RH_OPTIONS)[number];
