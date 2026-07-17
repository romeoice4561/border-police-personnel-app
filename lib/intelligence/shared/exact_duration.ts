/**
 * Exact-duration computation + Thai display formatting (Phase 40B).
 *
 * Wraps the existing, correct `differenceYMD` primitive
 * (lib/personnel_calendar/calendar.ts) with:
 *   1. explicit invalid-date guarding (an invalid Date never reaches
 *      differenceYMD and never renders "Invalid Date" to a user), and
 *   2. one canonical Thai duration formatter — "40 ปี 11 เดือน 6 วัน" —
 *      so every consumer that needs to show a duration uses the same
 *      wording instead of hand-rolling `${years} ปี ${months} เดือน`.
 *
 * Does NOT reimplement date-math: differenceYMD remains the single source
 * of truth for exact calendar duration. This module only adds the
 * available/reason envelope and Thai text on top.
 *
 * Pure — no I/O, no React.
 */

import { differenceYMD } from "@/lib/personnel_calendar";
import type { ExactDuration, ExactDurationResult } from "@/lib/intelligence/shared/date_types";

function isValidDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Computes the exact elapsed duration from `start` to `end`, guarding
 * against missing/invalid input. Never throws, never returns a duration for
 * an unusable input — returns `available: false` with a machine-readable
 * `reason` instead, so a caller can distinguish "not computable" from a
 * genuine zero-length duration.
 */
export function computeExactDuration(
  start: Date | null | undefined,
  end: Date | null | undefined,
  missingReason: string
): ExactDurationResult {
  if (!start) return { available: false, duration: null, reason: missingReason };
  if (!isValidDate(start) || !isValidDate(end ?? undefined)) {
    return { available: false, duration: null, reason: "INVALID_DATE" };
  }
  return { available: true, duration: differenceYMD(start, end as Date) };
}

/**
 * Formats an ExactDuration as Thai text: "40 ปี 11 เดือน 6 วัน". Always
 * shows all three units (even when 0) so the format is stable/parseable by
 * a human at a glance — never omits a unit based on its value.
 */
export function formatExactDurationTh(duration: ExactDuration | null): string {
  if (!duration) return "ไม่มีข้อมูล";
  return `${duration.years} ปี ${duration.months} เดือน ${duration.days} วัน`;
}

/** Same as formatExactDurationTh, but omits zero-value leading units (e.g. "6 วัน" instead of "0 ปี 0 เดือน 6 วัน") for compact contexts. Still returns the Thai fallback for a missing duration. */
export function formatExactDurationCompactTh(duration: ExactDuration | null): string {
  if (!duration) return "ไม่มีข้อมูล";
  const parts: string[] = [];
  if (duration.years > 0) parts.push(`${duration.years} ปี`);
  if (duration.months > 0 || parts.length > 0) parts.push(`${duration.months} เดือน`);
  parts.push(`${duration.days} วัน`);
  return parts.join(" ");
}
