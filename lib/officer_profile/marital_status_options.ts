/**
 * Marital status options (Phase 26B Part 5 Part G/L — Personal Information).
 *
 * Pure data — no I/O, no React.
 */

export const MARITAL_STATUS_OPTIONS = ["โสด", "สมรส", "หย่า", "หม้าย", "ไม่ระบุ"] as const;
export type MaritalStatus = (typeof MARITAL_STATUS_OPTIONS)[number];
