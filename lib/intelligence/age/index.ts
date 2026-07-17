/**
 * Age Engine — public Intelligence API (Phase 40A foundation; Phase 40B
 * strengthens the output per the Data Standardization spec).
 *
 * A thin facade over lib/personnel_calendar/calendar.ts's calculateAge (the
 * existing, stable primitive — not relocated or rewritten) plus the Phase
 * 40B exact-duration/Thai-display layer. Adds next-birthday tracking, which
 * has no prior implementation anywhere in the codebase (confirmed by the
 * Phase 40B audit) — this is the one genuinely new calculation in this
 * facade, built from the same UTC-safe date primitives
 * (lib/personnel_calendar/calendar.ts's addYears/differenceYMD).
 *
 * `ageYears` (decimal) is kept only for backward compatibility with any
 * existing caller reading it as a sortable number — it is NOT the primary
 * output. `exactAge`/`displayAgeTh` are the primary outputs.
 */

import { calculateAge, addYears, differenceYMD, dateOnly } from "@/lib/personnel_calendar";
import { yearsFromDuration } from "@/lib/intelligence/shared/duration";
import { formatExactDurationTh } from "@/lib/intelligence/shared/exact_duration";
import { formatFullThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { AgeSummary } from "@/lib/intelligence/shared/types";

function isValidDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * The officer's next birthday on/after `asOf`. If today IS the birthday,
 * returns today (0 days until, age = birthday's target age) rather than
 * skipping ahead a year — "next birthday" means "the next occurrence,
 * inclusive of today."
 */
function computeNextBirthday(dateOfBirth: Date, asOf: Date): { date: Date; age: number; daysUntil: number } {
  const today = dateOnly(asOf);
  const ageAtAsOf = differenceYMD(dateOfBirth, asOf).years;
  let candidateAge = ageAtAsOf;
  let candidate = addYears(dateOfBirth, candidateAge);
  if (candidate.getTime() < today.getTime()) {
    candidateAge += 1;
    candidate = addYears(dateOfBirth, candidateAge);
  }
  const daysUntil = Math.round((candidate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return { date: candidate, age: candidateAge, daysUntil };
}

/**
 * Computes an officer's full age summary from their date of birth.
 * `available: false` (not a computed zero) when dateOfBirth is missing or
 * invalid.
 */
export function computeAgeSummary(dateOfBirth: Date | null | undefined, asOf: Date = new Date()): AgeSummary {
  const asOfDate = dateOnly(asOf).toISOString().slice(0, 10);

  if (!dateOfBirth || !isValidDate(dateOfBirth)) {
    return {
      available: false,
      reason: !dateOfBirth ? "MISSING_DATE_OF_BIRTH" : "INVALID_DATE",
      asOfDate,
      birthDate: null,
      age: null,
      exactAge: null,
      ageYears: null,
      nextBirthdayDate: null,
      nextBirthdayAge: null,
      daysUntilNextBirthday: null,
      displayAgeTh: null,
      displayNextBirthdayTh: null,
    };
  }

  const age = calculateAge(dateOfBirth, asOf);
  const nextBirthday = computeNextBirthday(dateOfBirth, asOf);

  return {
    available: true,
    asOfDate,
    birthDate: dateOnly(dateOfBirth).toISOString().slice(0, 10),
    age,
    exactAge: age,
    ageYears: yearsFromDuration(age),
    nextBirthdayDate: dateOnly(nextBirthday.date).toISOString().slice(0, 10),
    nextBirthdayAge: nextBirthday.age,
    daysUntilNextBirthday: nextBirthday.daysUntil,
    displayAgeTh: formatExactDurationTh(age),
    displayNextBirthdayTh: `วันเกิดถัดไป ${formatFullThaiDateTh(nextBirthday.date)}`,
  };
}
