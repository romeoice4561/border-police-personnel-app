/**
 * Shared duration/date-math helpers (Personnel Intelligence Platform —
 * Phase 40A foundation).
 *
 * These three functions previously existed as VERBATIM-DUPLICATED private
 * helpers in two separate server services (lib/server/commander_intelligence_
 * service.ts and lib/server/commander_query_service.ts) — the one confirmed
 * instance of the same calculation living in two files. This is their single
 * new home; both services now import from here instead of defining their own
 * copy. No calculation changed — same inputs produce the same outputs.
 *
 * Pure — no I/O, no React, no database.
 */

import type { DurationYMD } from "@/lib/personnel_calendar";
import { differenceYMD } from "@/lib/personnel_calendar";

/** A DurationYMD expressed as a single decimal-years number (years + months/12 + days/365), rounded to 1 decimal place. */
export function yearsFromDuration(duration: DurationYMD | null): number | null {
  if (!duration) return null;
  return Number((duration.years + duration.months / 12 + duration.days / 365).toFixed(1));
}

/** Decimal years elapsed from `date` to `asOf`. Null when `date` is null. */
export function yearsSince(date: Date | null, asOf: Date): number | null {
  return yearsFromDuration(date ? differenceYMD(date, asOf) : null);
}

/**
 * Commander-facing YEAR-COUNT (not exact elapsed duration) between two
 * Buddhist-Era years — e.g. `currentYearBe - startYearBe`, never adding 1
 * after subtraction. Distinct from `yearsSince`/`yearsFromDuration`, which
 * compute an EXACT chronological duration (years/months/days from a real
 * date) that can truncate to N-1 whenever the anniversary hasn't occurred
 * yet within the current calendar year (e.g. a 2564 start observed on 17
 * July of fiscal year 2569 elapses only ~5 years 6 months if anchored
 * mid-year, but truncates to 4 when anchored later in the year or when the
 * start date is anchored past the as-of month/day) — the wrong number for
 * a commander-facing "how many BE years has this officer been at this
 * level" question, which is a calendar-year count, not a duration. Returns
 * null when either year is null (never a fabricated 0).
 */
export function yearCountSince(startYearBe: number | null, currentYearBe: number): number | null {
  if (startYearBe == null) return null;
  return currentYearBe - startYearBe;
}

/** A DurationYMD expressed as whole months, rounding any partial trailing day up to the next month. */
export function monthsFromDuration(duration: DurationYMD | null): number | null {
  if (!duration) return null;
  return duration.years * 12 + duration.months + (duration.days > 0 ? 1 : 0);
}
