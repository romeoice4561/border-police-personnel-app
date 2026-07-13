/**
 * Thai government retirement calculations.
 *
 * Officers retire at the end of the fiscal year in which they turn 60.
 * Since the Thai fiscal year ends on 30 September, an officer born on
 * 1 October or later retires on 30 September of the next Gregorian year.
 */

import { addYears, differenceYMD } from "@/lib/personnel_calendar/calendar";
import { currentFiscalYear, fiscalYearEnd } from "@/lib/personnel_calendar/fiscal_year";
import type { DurationYMD } from "@/lib/personnel_calendar/types";

export const THAI_GOVERNMENT_RETIREMENT_AGE = 60;

export interface RetirementCalculation {
  retirementAge: number;
  sixtiethBirthday: Date;
  retirementFiscalYear: number;
  retirementDate: Date;
  remaining: DurationYMD;
  isRetired: boolean;
}

export function calculateRetirementDate(
  dateOfBirth: Date,
  retirementAge: number = THAI_GOVERNMENT_RETIREMENT_AGE
): Date {
  const birthday = addYears(dateOfBirth, retirementAge);
  return fiscalYearEnd(currentFiscalYear(birthday));
}

export function calculateRetirement(
  dateOfBirth: Date | null | undefined,
  asOf: Date = new Date(),
  retirementAge: number = THAI_GOVERNMENT_RETIREMENT_AGE
): RetirementCalculation | null {
  if (!dateOfBirth) return null;

  const sixtiethBirthday = addYears(dateOfBirth, retirementAge);
  const retirementFiscalYear = currentFiscalYear(sixtiethBirthday);
  const retirementDate = fiscalYearEnd(retirementFiscalYear);
  const isRetired = asOf.getTime() > retirementDate.getTime();

  return {
    retirementAge,
    sixtiethBirthday,
    retirementFiscalYear,
    retirementDate,
    remaining: differenceYMD(asOf, retirementDate),
    isRetired,
  };
}
