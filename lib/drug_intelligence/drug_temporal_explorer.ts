/**
 * Temporal Explorer / "Crime Clock" pure engine (DI-8.7 V1.5A).
 *
 * Pure — no I/O, no React, no DB. Shared calculation layer for the
 * Crime Clock (24×1-hour circular view), the weekday cross-filter, the
 * date-range filter, matching-case results, and (future) entity
 * summaries / Map / Network handoff.
 *
 * This module does NOT reinterpret time. It reuses the canonical
 * primitives from drug_map_temporal.ts (DI-8.2.1):
 *   - minutesFromArrestTime — never invents 00:00 for missing time
 *   - isoWeekdayFromDateOnly / computeWeekdayFrequency
 *   - computeTemporalCoverage
 *   - computeTimeBucketFrequency (existing 8×3-hour buckets — untouched)
 *   - timeMatchesRange (midnight-wrap semantics)
 *
 * Dataset label: this engine only ever operates on arrestTime
 * (เวลาจับกุม). There is no incidentTime/offenseTime in the canonical
 * schema, so `dataset` is fixed at "ARREST_TIME" — never rename this to
 * imply "เวลาเกิดเหตุ" (time of offense) anywhere in the UI layer.
 *
 * Filter semantics (Section 9): date range AND weekday AND time range
 * all apply together (AND, not OR). A case with a date but no time
 * remains eligible for date-range/weekday analysis, but is EXCLUDED
 * the moment a time-range filter is active (missing time never matches
 * a time filter — see caseMatchesTimeFilter in drug_map_temporal.ts).
 */

import {
  type IsoWeekday,
  type TemporalCaseLite,
  type TemporalCoverage,
  ISO_WEEKDAYS,
  minutesFromArrestTime,
  isoWeekdayFromDateOnly,
  computeWeekdayFrequency,
  computeTemporalCoverage,
  caseMatchesWeekdays,
  timeMatchesRange,
} from "@/lib/drug_intelligence/drug_map_temporal";

// ── Input model ──────────────────────────────────────────────────────

/** A CASE, as available from the currently loaded Network neighborhood scope. */
export interface TemporalCaseRecord extends TemporalCaseLite {
  caseNumber: string;
  status: string;
  province: string | null;
  reportingUnitText: string | null;
}

/**
 * The shared filter state consumed by the Crime Clock, the weekday
 * selector, and (later) the date-range control. All controls read and
 * write the SAME TemporalSelection — there is no second filter state.
 *
 * dataset is fixed to "ARREST_TIME": the only real event-time field
 * that exists in the canonical schema today (see AGENTS.md/CLAUDE.md
 * "not the Next.js you know" note — irrelevant here, but the schema
 * constraint is equally non-negotiable). Do NOT add a dataset value for
 * an "incident time" that doesn't exist in the DB.
 */
export interface TemporalSelection {
  dataset: "ARREST_TIME";
  /** Inclusive date-only (YYYY-MM-DD), or undefined for no lower bound. */
  dateFrom?: string;
  /** Inclusive date-only (YYYY-MM-DD), or undefined for no upper bound. */
  dateTo?: string;
  /** ISO weekday filter; empty/undefined = all weekdays. */
  weekday?: IsoWeekday;
  /** Minute-of-day [0,1440) — set together with endMinute to activate a time filter. */
  startMinute?: number;
  /** Minute-of-day [0,1440) — see startMinute. */
  endMinute?: number;
}

export function emptyTemporalSelection(): TemporalSelection {
  return { dataset: "ARREST_TIME" };
}

export function isTimeFilterActive(selection: TemporalSelection): boolean {
  return selection.startMinute != null && selection.endMinute != null;
}

export function isSelectionEmpty(selection: TemporalSelection): boolean {
  return (
    selection.dateFrom == null &&
    selection.dateTo == null &&
    selection.weekday == null &&
    !isTimeFilterActive(selection)
  );
}

/** Clears only the time-range part of a selection (Section 15.D — "clear time selection"). */
export function clearTimeSelection(selection: TemporalSelection): TemporalSelection {
  const { startMinute: _startMinute, endMinute: _endMinute, ...rest } = selection;
  return { ...rest };
}

/** Full reset back to the 24-hour / all-time / all-weekday view (Section 15.E). */
export function resetTemporalSelection(): TemporalSelection {
  return emptyTemporalSelection();
}

// ── Date-range matching (date-only, never requires arrestTime) ─────────

function toDateOnlyString(value: string | Date | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const ymd = value.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  }
  if (Number.isNaN(value.getTime())) return null;
  const y = value.getUTCFullYear();
  const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function caseMatchesDateRange(
  arrestDate: string | Date | null,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): boolean {
  if (!dateFrom && !dateTo) return true;
  const dateOnly = toDateOnlyString(arrestDate);
  if (dateOnly == null) return false; // date filter active → dateless case excluded
  if (dateFrom && dateOnly < dateFrom) return false;
  if (dateTo && dateOnly > dateTo) return false;
  return true;
}

// ── Selection matching (AND across date range / weekday / time) ────────

/**
 * A single case matches the full selection iff it passes EVERY active
 * sub-filter (Section 9). Date-only cases remain eligible for
 * date-range/weekday sub-filters but are excluded the instant the time
 * sub-filter is active (they have no minute to test against).
 */
export function caseMatchesTemporalSelection<T extends TemporalCaseRecord>(
  record: T,
  selection: TemporalSelection,
): boolean {
  if (!caseMatchesDateRange(record.arrestDate, selection.dateFrom, selection.dateTo)) return false;
  if (selection.weekday != null && !caseMatchesWeekdays(record.arrestDate, [selection.weekday])) return false;
  if (isTimeFilterActive(selection)) {
    const minute = minutesFromArrestTime(record.arrestTime);
    if (minute == null) return false; // missing arrestTime never matches an active time filter
    if (!timeMatchesRange(minute, selection.startMinute!, selection.endMinute!, { endInclusive: false })) return false;
  }
  return true;
}

export function filterCasesByTemporalSelection<T extends TemporalCaseRecord>(
  cases: readonly T[],
  selection: TemporalSelection,
): T[] {
  return cases.filter((record) => caseMatchesTemporalSelection(record, selection));
}

// ── Coverage model (Section 10) ─────────────────────────────────────────

export type TemporalCoverageModel = TemporalCoverage & {
  /** Cases with a usable arrestDate (independent of arrestTime). */
  withDate: number;
  withoutDate: number;
};

export function computeTemporalCoverageModel(cases: readonly TemporalCaseRecord[]): TemporalCoverageModel {
  const base = computeTemporalCoverage(cases);
  let withDate = 0;
  for (const c of cases) {
    if (toDateOnlyString(c.arrestDate) != null) withDate += 1;
  }
  return { ...base, withDate, withoutDate: base.total - withDate };
}

// ── 24×1-hour distribution for the Crime Clock (Section 11) ────────────

export interface HourlyBucket {
  /** 0–23. */
  hour: number;
  count: number;
  caseIds: string[];
  /** 0–100, one decimal place, relative to cases WITH arrestTime (not total scope). 0 when no cases have time. */
  percentOfCasesWithTime: number;
}

/**
 * 24 hourly buckets (00:00–00:59 … 23:00–23:59), using the exact same
 * canonical arrestTime parser/null semantics as computeTimeBucketFrequency
 * (drug_map_temporal.ts) — this is a finer-grained PROJECTION of the same
 * underlying time interpretation, never a second engine. The existing
 * 8×3-hour MAP_TIME_BUCKETS system (Section 12) is untouched and
 * unrelated to this function.
 *
 * A minute value belongs to hour = floor(minute / 60); minute 1439 (23:59)
 * belongs to hour 23. Only cases with a REAL recorded arrestTime
 * contribute — minute 0 (00:00) only appears here when it was actually
 * recorded, never as a stand-in for "no time".
 */
export function computeHourlyDistribution(cases: readonly TemporalCaseRecord[]): HourlyBucket[] {
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    caseIds: [],
    percentOfCasesWithTime: 0,
  }));
  let withTime = 0;
  for (const c of cases) {
    const minute = minutesFromArrestTime(c.arrestTime);
    if (minute == null) continue;
    withTime += 1;
    const hour = Math.min(23, Math.floor(minute / 60));
    buckets[hour].count += 1;
    buckets[hour].caseIds.push(c.id);
  }
  if (withTime > 0) {
    for (const bucket of buckets) {
      bucket.percentOfCasesWithTime = Math.round((bucket.count / withTime) * 1000) / 10;
    }
  }
  return buckets;
}

/**
 * Top N non-zero hourly buckets (VISUAL HOTFIX 2, Section 11 —
 * "ช่วงเวลาที่มีจำนวนคดีสูงสุด"). Pure projection of the SAME
 * hourlyDistribution — never a second aggregation. Deterministic tie-break:
 * count DESCENDING, then hour ASCENDING. Zero-count hours are always
 * excluded — "fewer than N non-zero hours exist" naturally yields a
 * shorter (possibly empty) array rather than padding with zero buckets.
 */
export function computeTopHourlyBuckets(
  hourlyDistribution: readonly HourlyBucket[],
  limit = 3,
): HourlyBucket[] {
  return hourlyDistribution
    .filter((b) => b.count > 0)
    .slice()
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.hour - b.hour))
    .slice(0, limit);
}

// ── Weekday frequency (thin re-export wrapper for UI convenience) ──────

export function computeTemporalWeekdayFrequency(cases: readonly TemporalCaseRecord[]): Record<IsoWeekday, number> {
  return computeWeekdayFrequency(cases);
}

export { ISO_WEEKDAYS, isoWeekdayFromDateOnly };
export type { IsoWeekday };

// ── Result payload (Section 18/22) ──────────────────────────────────────

export interface TemporalSelectionResult {
  selection: TemporalSelection;
  matchingCaseIds: string[];
  matchingCaseCount: number;
  coverage: TemporalCoverageModel;
  hourlyDistribution: HourlyBucket[];
  weekdayFrequency: Record<IsoWeekday, number>;
}

/**
 * Computes the full result for a given selection over the current
 * scope (currently-loaded Network neighborhood cases — Section 20; no
 * global DB aggregation in this version).
 *
 * hourlyDistribution and weekdayFrequency are always computed from the
 * FULL scope (not re-filtered by the selection's own time/weekday sub-
 * filter) so the clock/weekday chips keep showing the shape of the
 * whole dataset for orientation; matchingCaseIds is what the selection
 * actually narrows down to. This mirrors how the Map's existing preset
 * buckets behave — the distribution is a scope-level fact, the
 * selection is a query against it.
 *
 * matchingCaseIds is returned in the same order as the input `cases`
 * array (deterministic, input-order-preserving — Section 28 "M").
 */
export function computeTemporalSelectionResult(
  cases: readonly TemporalCaseRecord[],
  selection: TemporalSelection,
): TemporalSelectionResult {
  const matching = filterCasesByTemporalSelection(cases, selection);
  return {
    selection,
    matchingCaseIds: matching.map((c) => c.id),
    matchingCaseCount: matching.length,
    coverage: computeTemporalCoverageModel(cases),
    hourlyDistribution: computeHourlyDistribution(cases),
    weekdayFrequency: computeTemporalWeekdayFrequency(cases),
  };
}
