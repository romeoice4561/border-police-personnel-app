/**
 * Career calculator over the structured Timeline date model (Phase 26B Part
 * 3 — foundation for Phase 26 Part 4/Part 14; display/editor-side only).
 *
 * Distinct from lib/career/career_engine.ts (Phase 25's import-pipeline
 * career estimate over raw PersonnelExtraction JSON, untouched by this
 * phase) — this module operates on PERSISTED Timeline rows with real
 * `effectiveDate`s, used by the officer workspace and future promotion-prep
 * screens. Pure derivation — no I/O, no database, no React.
 */

import { toEffectiveDate } from "@/lib/officer_profile/thai_date";

export interface TimelineDateLike {
  day?: number | null;
  month?: number | null;
  yearBE?: number | null;
  isPresent?: boolean;
  /** Same-row grouping fields, so the calculator can report years-in-rank / years-in-position. */
  rank?: string | null;
  position?: string;
  unit?: string | null;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** An entry's own start date, whether or not it is ongoing — callers substitute `today` as the END date for an ongoing entry, never as its start. */
function effectiveDateOf(entry: TimelineDateLike): Date | null {
  return toEffectiveDate(entry);
}

function yearsBetween(start: Date, end: Date): number {
  const years = (end.getTime() - start.getTime()) / MS_PER_YEAR;
  return Math.max(0, Math.round(years * 100) / 100);
}

/** Sorts structured timeline entries oldest -> newest by effectiveDate; entries with no derivable date sort last, stable otherwise. */
export function sortByEffectiveDate<T extends TimelineDateLike>(entries: readonly T[]): T[] {
  return [...entries]
    .map((entry, index) => ({ entry, index, date: effectiveDateOf(entry) }))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return a.index - b.index;
    })
    .map((x) => x.entry);
}

/**
 * Total years of service: earliest entry's effectiveDate to either the
 * latest entry's effectiveDate, or today when any entry isPresent (an
 * ongoing career is still accruing). Returns 0 when fewer than one
 * dateable entry exists.
 */
export function calculateCareerYears<T extends TimelineDateLike>(entries: readonly T[], today: Date = new Date()): number {
  const dated = entries.map((e) => ({ entry: e, date: effectiveDateOf(e) })).filter((x): x is { entry: T; date: Date } => x.date !== null);
  if (dated.length === 0) return 0;

  const hasOngoing = entries.some((e) => e.isPresent);
  const earliest = dated.reduce((min, x) => (x.date < min ? x.date : min), dated[0].date);
  const latest = hasOngoing ? today : dated.reduce((max, x) => (x.date > max ? x.date : max), dated[0].date);

  return yearsBetween(earliest, latest);
}

/**
 * Years in the CURRENT rank: from the most recent entry whose `rank` first
 * changed to its present value, through today (or the latest dateable
 * entry when no entry is marked present). Returns 0 when the current rank
 * can't be determined (no dated entries).
 */
export function calculateYearsInRank<T extends TimelineDateLike>(entries: readonly T[], today: Date = new Date()): number {
  return yearsInGroup(entries, (e) => e.rank ?? null, today);
}

/** Years in the CURRENT position — same logic as calculateYearsInRank, grouped by `position` instead. */
export function calculateYearsInPosition<T extends TimelineDateLike>(entries: readonly T[], today: Date = new Date()): number {
  return yearsInGroup(entries, (e) => e.position ?? null, today);
}

function yearsInGroup<T extends TimelineDateLike>(entries: readonly T[], key: (e: T) => string | null, today: Date): number {
  const sorted = sortByEffectiveDate(entries);
  const dated = sorted
    .map((entry) => ({ entry, date: effectiveDateOf(entry) }))
    .filter((x): x is { entry: T; date: Date } => x.date !== null);
  if (dated.length === 0) return 0;

  const currentKey = key(dated[dated.length - 1].entry);
  if (currentKey === null) return 0;

  // Walk backward from the most recent entry while the group key stays the same.
  let startIndex = dated.length - 1;
  while (startIndex > 0 && key(dated[startIndex - 1].entry) === currentKey) startIndex -= 1;

  const start = dated[startIndex].date;
  const hasOngoing = entries.some((e) => e.isPresent);
  const end = hasOngoing ? today : dated[dated.length - 1].date;
  return yearsBetween(start, end);
}

/**
 * Promotion waiting period: years since the most recent RANK change (i.e.
 * the same value as calculateYearsInRank, exposed under the Part 4/Part 14
 * name so callers reading for "how long has this officer been waiting for
 * their next promotion" don't have to know it's the same computation as
 * "years in current rank").
 */
export function calculatePromotionWaitingYears<T extends TimelineDateLike>(entries: readonly T[], today: Date = new Date()): number {
  return calculateYearsInRank(entries, today);
}
