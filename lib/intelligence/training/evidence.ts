/**
 * Training row -> TrainingRecordEvidence (Phase 45).
 *
 * Converts a persisted `Training` row into the normalized evidence shape
 * the evaluator/data-quality checks consume. Conservative: `Training.year`
 * is free text (no real date column), so a completion date is derived ONLY
 * when the value is unambiguously a 4-digit Buddhist-Era year — anything
 * else (a range, a Thai month name, blank) yields `completionDate: null`
 * rather than a guessed date. `expiryDate`/`certificateNumber`/`verified`
 * are always null — the schema has no such columns (see the module's
 * types.ts doc comment).
 *
 * Pure — no I/O, no React.
 */
import type { Training } from "@/lib/database/query_types";
import { normalizeCourseName } from "@/lib/intelligence/training/course_normalization";
import { yearBEToGregorian, isValidYearBE } from "@/lib/officer_profile/thai_date";
import type { TrainingRecordEvidence } from "@/lib/intelligence/training/types";

const PLAIN_YEAR_BE_PATTERN = /^\d{4}$/;

/** Best-effort completion date from `Training.year` — ISO YYYY-01-01 anchor when the value is unambiguously a 4-digit Buddhist-Era year, null otherwise (never guessed from a range/partial string). */
function completionDateFromYearField(year: string | null): string | null {
  if (!year) return null;
  const trimmed = year.trim();
  if (!PLAIN_YEAR_BE_PATTERN.test(trimmed)) return null;
  const yearBe = Number(trimmed);
  if (!isValidYearBE(yearBe)) return null;
  const gregorianYear = yearBEToGregorian(yearBe);
  return `${gregorianYear}-01-01`;
}

export function toTrainingRecordEvidence(row: Training): TrainingRecordEvidence {
  const normalized = normalizeCourseName(row.course);
  return {
    recordId: row.id,
    courseName: row.course ?? "",
    normalizedCourseKey: normalized.normalizedCourseKey,
    provider: row.organization ?? null,
    completionDate: completionDateFromYearField(row.year ?? null),
    expiryDate: null,
    certificateNumber: null,
    verified: null,
    source: null,
  };
}

export function toTrainingRecordEvidenceBatch(rows: readonly Training[]): TrainingRecordEvidence[] {
  return rows.map(toTrainingRecordEvidence);
}
