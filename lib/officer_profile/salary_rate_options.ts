/**
 * Salary rate CANDIDATE options (Phase 45.1 refinement pass, Part 3/4/5/6/7).
 *
 * ============================================================================
 * CRITICAL DATA LIMITATION — READ BEFORE EXTENDING THIS FILE
 * ============================================================================
 * The source personnel-pay data supplies:
 *   - a set of salary STEPS (1.0 through 43.5, in 0.5 increments)
 *   - a broad salary LEVEL range (พ.1, ป.1-ป.3, ส.1-ส.8)
 *   - one or more salary AMOUNTS observed for each step
 *
 * It does NOT reliably state which exact amount belongs to which exact
 * level. Example: step 32.0 has four observed amounts (37,580 / 40,560 /
 * 50,640 / 70,360 บาท), but the source data does not say which of those
 * four belongs to พ.1 vs. ป.1 vs. ป.2 vs. ... vs. ส.8 at that step.
 *
 * Because of that gap, this module is NOT an authoritative level->step->
 * amount mapping, and must never be treated as one:
 *   - SALARY_LEVEL_OPTIONS and SALARY_STEP_OPTIONS are independent closed
 *     lists (what a human may SELECT for each field).
 *   - SALARY_STEP_RATE_OPTIONS maps a STEP to its CANDIDATE amounts only —
 *     never a (level, step) pair to a single amount.
 *   - No function here ever infers a salary from a level, or a level from
 *     a salary. `currentSalary` remains manual/candidate-assisted entry,
 *     always human-confirmed against the source document — see
 *     components/officer/membership_financial_editor.tsx's
 *     "กรุณาเลือกให้ตรงกับเอกสารต้นทาง" guidance.
 *
 * A future pass MAY replace this with a true, complete, source-verified
 * level->step->amount table — if that happens, this file's CANDIDATE model
 * should be retired in favor of exact lookup, not extended to fake one.
 *
 * Pure data — no I/O, no React, no Intelligence calculation (this remains
 * factual Master Data; see docs/PERSONNEL_MASTER_DATA_STANDARD.md).
 */

/** รุ่น นรต. dropdown is unrelated — this is the ระดับเงินเดือน closed set (Part 4). "ไม่ระบุ" is the empty/placeholder selection, not a stored value. */
export const SALARY_LEVEL_OPTIONS = [
  "พ.1",
  "ป.1",
  "ป.2",
  "ป.3",
  "ส.1",
  "ส.2",
  "ส.3",
  "ส.4",
  "ส.5",
  "ส.6",
  "ส.7",
  "ส.8",
] as const;

export type SalaryLevelOption = (typeof SALARY_LEVEL_OPTIONS)[number];

export function isKnownSalaryLevel(value: string): value is SalaryLevelOption {
  return (SALARY_LEVEL_OPTIONS as readonly string[]).includes(value);
}

/**
 * ขั้นเงินเดือน closed set (Part 5) — 1.0 through 43.5 in 0.5 increments,
 * sorted DESCENDING (43.5 first) per spec. Distinct from
 * lib/officer_profile/salary_step_options.ts's SALARY_STEP_OPTIONS (0.5/1.0/
 * 1.5/2.0), which is the yearly step-INCREMENT an officer receives for
 * Salary Intelligence's "2 ขั้น" rule — a completely different concept from
 * this officer's CURRENT pay-scale step.
 */
export const SALARY_STEP_SCALE_OPTIONS: readonly number[] = Array.from({ length: 86 }, (_, i) => 43.5 - i * 0.5);

export function isKnownSalaryStep(value: number): boolean {
  return SALARY_STEP_SCALE_OPTIONS.includes(value);
}

/** "ขั้น 43.5" — display formatting for a salary-step-scale value. */
export function formatSalaryStepScale(step: number): string {
  return `ขั้น ${step.toFixed(1)}`;
}

export interface SalaryStepRateOption {
  step: string;
  candidateSalaries: number[];
}

/**
 * Candidate salary amounts observed per step, as supplied in the source
 * data. Every step in SALARY_STEP_SCALE_OPTIONS that had at least one
 * observed amount in the source data is listed; a step absent from this
 * table simply has no candidates (the UI falls back to manual entry only —
 * never a fabricated amount). Keyed by the step's string form ("32.0", not
 * the number 32) to avoid floating-point key-matching bugs.
 *
 * SOURCE: the original request's Part 3 example data (step 32.0: 37,580 /
 * 40,560 / 50,640 / 70,360 บาท) plus the bug-fix pass's step 25.5 data
 * (20,180 / 27,890 / 30,220 / 33,000 / 40,560 / 48,200 / 56,610 / 66,960
 * บาท). Only these two steps are populated today because they are the
 * only steps for which candidate amounts were supplied — this table is
 * deliberately NOT filled in for every step with a guess. Extend it only
 * when real source data for a specific step is available.
 */
export const SALARY_STEP_RATE_OPTIONS: readonly SalaryStepRateOption[] = [
  { step: "25.5", candidateSalaries: [20180, 27890, 30220, 33000, 40560, 48200, 56610, 66960] },
  { step: "32.0", candidateSalaries: [37580, 40560, 50640, 70360] },
];

/** Looks up candidate amounts for a step (string form, e.g. "32.0"); returns an empty array when the step has no known candidates — never guessed. */
export function candidateSalariesForStep(step: string): number[] {
  return SALARY_STEP_RATE_OPTIONS.find((row) => row.step === step)?.candidateSalaries ?? [];
}

/**
 * Strips the "ขั้น " display prefix from a formatted step string (e.g.
 * "ขั้น 32.0" -> "32.0"), so it can be used as a SALARY_STEP_RATE_OPTIONS
 * lookup key. A step value with no prefix (already raw, or a legacy custom
 * value) passes through trimmed and unchanged.
 */
export function stepDisplayToKey(stepDisplay: string): string {
  return stepDisplay.replace(/^ขั้น\s*/, "").trim();
}

/**
 * True when `text` is exactly a formatted money string this module
 * produces (e.g. "40,560 บาท") — used by the current-salary Combobox to
 * decide whether a selected/typed value should be normalized back to a raw
 * numeric string before being stored in ProfileDraft.currentSalary (which
 * must stay a plain numeric string for the save mapping's
 * `Number(profile.currentSalary)` — see components/officer/
 * use_officer_workspace.ts).
 */
export function looksLikeFormattedMoney(text: string): boolean {
  return /^[\d,]+(?:\.\d{1,2})?\s*บาท$/.test(text.trim());
}

/**
 * Inverse of formatMoneyTh for suggestion clicks.
 * Preserves up to 2 decimal places ("48,200.50 บาท" → "48200.50").
 */
export function parseFormattedMoneyDigits(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^([\d,]+)(?:\.(\d{1,2}))?\s*บาท$/);
  if (!m) return trimmed.replace(/[^\d.]/g, "");
  const intPart = m[1].replace(/,/g, "");
  return m[2] != null ? `${intPart}.${m[2]}` : intPart;
}
