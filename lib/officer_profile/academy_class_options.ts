/**
 * Police Cadet Academy Class options (Phase 45.1 — Personnel Master Data
 * Expansion, Task 3).
 *
 * A true closed set — the approved range is 40 through 100 inclusive, plus
 * an explicit "ไม่ระบุ / Not specified" (rendered by the dropdown as the
 * empty option, not a value in this list). Never free text: academy class is
 * never inferred from age, appointment date, filename, or timeline.
 *
 * Pure data — no I/O, no React.
 */

export const ACADEMY_CLASS_MIN = 40;
export const ACADEMY_CLASS_MAX = 100;

export const ACADEMY_CLASS_OPTIONS: readonly number[] = Array.from(
  { length: ACADEMY_CLASS_MAX - ACADEMY_CLASS_MIN + 1 },
  (_, i) => ACADEMY_CLASS_MIN + i
);

export function isValidAcademyClass(value: number): boolean {
  return Number.isInteger(value) && value >= ACADEMY_CLASS_MIN && value <= ACADEMY_CLASS_MAX;
}

/** "นรต.รุ่น 61" — never rendered from a guessed/derived value. */
export function formatAcademyClassTh(academyClass: number): string {
  return `นรต.รุ่น ${academyClass}`;
}

/** "PCA Class 61". */
export function formatAcademyClassEn(academyClass: number): string {
  return `PCA Class ${academyClass}`;
}
