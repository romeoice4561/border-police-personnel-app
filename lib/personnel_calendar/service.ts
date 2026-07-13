/**
 * Government service duration calculations.
 *
 * Service time is anchored to the official government service start date,
 * never to date of birth or imported career estimates.
 */

import { differenceYMD } from "@/lib/personnel_calendar/calendar";
import type { DurationYMD } from "@/lib/personnel_calendar/types";

export function calculateGovernmentServiceDuration(
  governmentServiceStartDate: Date | null | undefined,
  asOf: Date = new Date()
): DurationYMD | null {
  if (!governmentServiceStartDate) return null;
  return differenceYMD(governmentServiceStartDate, asOf);
}
