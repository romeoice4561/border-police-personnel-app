/**
 * Calendar primitives for exact date math.
 *
 * All calculations normalize to UTC date-only values so local timezone/DST
 * never shifts a personnel date by one day.
 */

import type { DurationYMD } from "@/lib/personnel_calendar/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function compareDates(a: Date, b: Date): number {
  return dateOnly(a).getTime() - dateOnly(b).getTime();
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addYears(date: Date, years: number): Date {
  const d = dateOnly(date);
  const targetYear = d.getUTCFullYear() + years;
  const month = d.getUTCMonth() + 1;
  const day = Math.min(d.getUTCDate(), daysInMonth(targetYear, month));
  return utcDate(targetYear, month, day);
}

export function addDays(date: Date, days: number): Date {
  return new Date(dateOnly(date).getTime() + days * MS_PER_DAY);
}

/** Exact elapsed calendar duration from start to end. Negative ranges return zero. */
export function differenceYMD(start: Date, end: Date): DurationYMD {
  const from = dateOnly(start);
  const to = dateOnly(end);
  if (compareDates(to, from) < 0) return { years: 0, months: 0, days: 0 };

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();

  if (days < 0) {
    months -= 1;
    const previousMonth = to.getUTCMonth() === 0 ? 12 : to.getUTCMonth();
    const previousMonthYear = to.getUTCMonth() === 0 ? to.getUTCFullYear() - 1 : to.getUTCFullYear();
    days += daysInMonth(previousMonthYear, previousMonth);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function calculateAge(dateOfBirth: Date | null | undefined, asOf: Date = new Date()): DurationYMD | null {
  if (!dateOfBirth) return null;
  return differenceYMD(dateOfBirth, asOf);
}
