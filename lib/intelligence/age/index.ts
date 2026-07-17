/**
 * Age Engine — public Intelligence API (Phase 40A foundation).
 *
 * A thin facade over lib/personnel_calendar/calendar.ts's calculateAge — the
 * existing, stable primitive. Not relocated or rewritten. See
 * lib/intelligence/retirement/index.ts for the same rationale.
 */

import { calculateAge } from "@/lib/personnel_calendar";
import { yearsFromDuration } from "@/lib/intelligence/shared/duration";
import type { AgeSummary } from "@/lib/intelligence/shared/types";

/** Computes an officer's current-age summary from their date of birth. `available: false` (not a computed zero) when dateOfBirth is missing. */
export function computeAgeSummary(dateOfBirth: Date | null | undefined, asOf: Date = new Date()): AgeSummary {
  const age = calculateAge(dateOfBirth, asOf);
  if (!age) {
    return { available: false, age: null, ageYears: null };
  }
  return { available: true, age, ageYears: yearsFromDuration(age) };
}
