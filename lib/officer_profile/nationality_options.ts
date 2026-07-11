/**
 * Nationality options (Phase 26B Part 5 Part G/L — Personal Information).
 *
 * Default "ไทย" plus a Combobox suggestion list — free typing always
 * allowed ("Allow custom" per spec).
 *
 * Pure data — no I/O, no React.
 */

export const DEFAULT_NATIONALITY = "ไทย";

export const NATIONALITY_OPTIONS = [DEFAULT_NATIONALITY, "พม่า", "ลาว", "กัมพูชา", "เวียดนาม", "จีน", "อื่น ๆ"] as const;
