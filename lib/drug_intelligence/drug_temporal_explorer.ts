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

// ── Temporal graph focus (DI-8.7 V1.5B) ─────────────────────────────────

/** Minimal structural shape this module needs from a loaded graph node — never imports DrugGraphNode itself, to keep this engine dependency-free of the graph client types. */
export interface TemporalGraphFocusNode {
  id: string;
}

/** Minimal structural shape this module needs from a loaded graph edge. */
export interface TemporalGraphFocusEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Presentation-only graph-focus payload for "ดูบนผัง" from the Crime
 * Clock — reuses the exact same {nodeIds, edgeIds} contract the DI-8.7 V1
 * insight focus (InsightGraphFocus) and DI-8.4 emphasizedPath already
 * accept. Never a new highlight mechanism, never mutates graph data,
 * never a new edge-classification concept.
 */
export interface TemporalGraphFocus {
  caseIds: string[];
  nodeIds: string[];
  edgeIds: string[];
  /** A real non-focus node id from nodeIds, to drive the existing selectedSecondaryId mechanism (required for the flow adapter's dimming to activate — see drug_network_graph_flow_adapter.ts). Prefers the first matching CASE id. Null only if nodeIds is empty. */
  primaryNodeId: string | null;
  selectionLabel: string;
  matchingCaseCount: number;
}

/**
 * Derives the temporal focus subgraph from matchingCaseIds against the
 * CURRENTLY LOADED neighborhood only (Section 4/5 — no second fetch, no
 * BFS, no recursive expansion):
 *
 *   A. every matching CASE node id (that actually exists in `nodes`)
 *   B. every edge that DIRECTLY touches a matching CASE node id
 *   C. the OPPOSITE endpoint of each such edge
 *
 * This is a single, non-recursive pass — it never expands from a
 * supporting entity to ITS other cases/edges (Section 5/6: a phone
 * shared between a matching case and a non-matching case must not pull
 * the non-matching case's edge in).
 *
 * Unknown/missing case ids (not present in `nodes`) are safely ignored.
 * Duplicate case ids never duplicate focus ids (Set-based accumulation).
 */
export function computeTemporalGraphFocus(args: {
  nodes: readonly TemporalGraphFocusNode[];
  edges: readonly TemporalGraphFocusEdge[];
  matchingCaseIds: readonly string[];
  selectionLabel: string;
}): TemporalGraphFocus | null {
  const nodeIdSet = new Set(args.nodes.map((n) => n.id));
  const matchingCaseIdSet = new Set(args.matchingCaseIds.filter((id) => nodeIdSet.has(id)));
  if (matchingCaseIdSet.size === 0) return null;

  const focusNodeIds = new Set<string>(matchingCaseIdSet);
  const focusEdgeIds = new Set<string>();

  for (const edge of args.edges) {
    const sourceIsCase = matchingCaseIdSet.has(edge.source);
    const targetIsCase = matchingCaseIdSet.has(edge.target);
    if (!sourceIsCase && !targetIsCase) continue;
    focusEdgeIds.add(edge.id);
    // The opposite endpoint only — never recurse further from it.
    if (sourceIsCase) focusNodeIds.add(edge.target);
    if (targetIsCase) focusNodeIds.add(edge.source);
  }

  // Deterministic ordering: case ids first (deduplicated, in
  // matchingCaseIds' own first-seen order), then supporting entity ids
  // in first-seen edge order.
  const seenCaseIds = new Set<string>();
  const orderedCaseIds = args.matchingCaseIds.filter((id) => {
    if (!matchingCaseIdSet.has(id) || seenCaseIds.has(id)) return false;
    seenCaseIds.add(id);
    return true;
  });
  const orderedNodeIds = [
    ...orderedCaseIds,
    ...[...focusNodeIds].filter((id) => !matchingCaseIdSet.has(id)),
  ];

  return {
    caseIds: [...matchingCaseIdSet],
    nodeIds: orderedNodeIds,
    edgeIds: [...focusEdgeIds],
    primaryNodeId: args.matchingCaseIds.find((id) => matchingCaseIdSet.has(id)) ?? orderedNodeIds[0] ?? null,
    selectionLabel: args.selectionLabel,
    matchingCaseCount: matchingCaseIdSet.size,
  };
}

/**
 * Section 11 semantic check: is this selection an "effective" narrowing
 * of the loaded scope, or would "ดูบนผัง" just re-show everything that
 * was already visible? True when EITHER a time filter OR a weekday
 * filter OR a date-range filter is active — i.e. isSelectionEmpty is
 * false. A selection can be "24 hours" while still being an effective
 * filter if date/weekday narrows it; only a fully empty selection (no
 * filter at all) is non-effective. This is a semantic check on the
 * SELECTION itself, never on rendered display text.
 */
export function isEffectiveTemporalNarrowing(selection: TemporalSelection): boolean {
  return !isSelectionEmpty(selection);
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

// ── URL serialization for cross-page temporal context (DI-8.7 V1.5B) ───

/**
 * Distinct query-param prefix ("t" for "temporal") — deliberately NOT
 * dateFrom/dateTo, which the Network page's own graph date-range filter
 * already owns. Never collides with any existing Network URL param.
 */
export const TEMPORAL_URL_PARAMS = {
  dateFrom: "tDateFrom",
  dateTo: "tDateTo",
  weekday: "tWeekday",
  startMinute: "tStart",
  endMinute: "tEnd",
  /** Presence (value "1") signals "reconstruct temporal graph focus on load" — distinct from merely restoring the selection into a collapsed Crime Clock. */
  focusActive: "tFocus",
} as const;

/**
 * Serializes a TemporalSelection into a plain params object suitable for
 * URLSearchParams — only the fields that are actually set are included
 * (Section 6: "only serialize the temporal selection/context needed").
 * dataset is never serialized — it is always the fixed "ARREST_TIME"
 * constant and is reconstructed by emptyTemporalSelection()/the parser.
 */
export function serializeTemporalSelectionParams(
  selection: TemporalSelection,
  opts?: { focusActive?: boolean },
): Record<string, string> {
  const params: Record<string, string> = {};
  if (selection.dateFrom) params[TEMPORAL_URL_PARAMS.dateFrom] = selection.dateFrom;
  if (selection.dateTo) params[TEMPORAL_URL_PARAMS.dateTo] = selection.dateTo;
  if (selection.weekday != null) params[TEMPORAL_URL_PARAMS.weekday] = String(selection.weekday);
  if (selection.startMinute != null) params[TEMPORAL_URL_PARAMS.startMinute] = String(selection.startMinute);
  if (selection.endMinute != null) params[TEMPORAL_URL_PARAMS.endMinute] = String(selection.endMinute);
  if (opts?.focusActive) params[TEMPORAL_URL_PARAMS.focusActive] = "1";
  return params;
}

/**
 * Parses a TemporalSelection back out of a URLSearchParams-like reader.
 * Deterministic: absent/invalid fields are simply omitted (never
 * fabricated), matching emptyTemporalSelection()'s all-undefined shape
 * when nothing is present. Never trusts a raw string into
 * TemporalSelection without validating it parses to a real number/weekday.
 */
export function parseTemporalSelectionFromParams(
  params: { get(name: string): string | null },
): TemporalSelection {
  const selection: TemporalSelection = { dataset: "ARREST_TIME" };
  const dateFrom = params.get(TEMPORAL_URL_PARAMS.dateFrom);
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) selection.dateFrom = dateFrom;
  const dateTo = params.get(TEMPORAL_URL_PARAMS.dateTo);
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) selection.dateTo = dateTo;
  const weekdayRaw = params.get(TEMPORAL_URL_PARAMS.weekday);
  if (weekdayRaw != null) {
    const weekday = Number(weekdayRaw);
    if (Number.isInteger(weekday) && weekday >= 1 && weekday <= 7) selection.weekday = weekday as IsoWeekday;
  }
  const startRaw = params.get(TEMPORAL_URL_PARAMS.startMinute);
  const endRaw = params.get(TEMPORAL_URL_PARAMS.endMinute);
  if (startRaw != null && endRaw != null) {
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= 1440 && end >= 0 && end <= 1440) {
      selection.startMinute = start;
      selection.endMinute = end;
    }
  }
  return selection;
}

/** True when the params carry the "reconstruct temporal graph focus on load" flag. */
export function shouldRestoreTemporalGraphFocus(params: { get(name: string): string | null }): boolean {
  return params.get(TEMPORAL_URL_PARAMS.focusActive) === "1";
}

/**
 * DI-8.7 V1.5B VISUAL HOTFIX ROUND 3 — pure lifecycle predicate for the
 * Network page's temporal-focus restoration effect.
 *
 * ROOT CAUSE this fixes: the original implementation guarded restoration
 * with a plain one-shot boolean ref tied to the PAGE COMPONENT'S INSTANCE
 * lifetime. Next.js App Router reuses the same mounted page instance for a
 * same-route, query-only navigation (exactly what "กลับไปดูคดีตามช่วงเวลา"
 * does), so a user who was already on /drug-intelligence/network before
 * ever opening the Crime Clock had already consumed that boolean guard on
 * the FIRST mount (when no tFocus was present) — the later real return
 * trip's restoration request was silently skipped.
 *
 * Fix: key the "already attempted" guard on the RESTORE REQUEST ITSELF
 * (the raw serialized query string), not a single boolean, and treat
 * "neighborhood not loaded yet" as "not yet attempted" (never consume the
 * key while data is still loading) so restoration correctly retries once
 * the neighborhood arrives — Section 3's required semantics, made directly
 * testable here without any React/timer/effect machinery.
 */
export function shouldAttemptTemporalRestore(args: {
  /** The current restore-request signature — pass searchParams.toString(). */
  restoreKey: string;
  /** The most recently ATTEMPTED (successfully processed or determined irrelevant) restore key, or null if none yet. */
  lastAttemptedRestoreKey: string | null;
  /** True once the neighborhood this restore request needs is loaded. */
  hasNeighborhoodData: boolean;
  /** Whether this restoreKey actually represents a restoration request (shouldRestoreTemporalGraphFocus's result). */
  isRestoreRequest: boolean;
}): { attempt: boolean; consumeKey: boolean } {
  if (args.lastAttemptedRestoreKey === args.restoreKey) {
    // Already attempted (successfully or determined irrelevant) this exact request — never re-attempt or loop.
    return { attempt: false, consumeKey: false };
  }
  if (!args.isRestoreRequest) {
    // Not a restoration request at all — nothing to defer on; consume immediately so it's never mistaken for pending work.
    return { attempt: false, consumeKey: true };
  }
  if (!args.hasNeighborhoodData) {
    // A real request IS present, but its required data isn't ready — do NOT consume the key; retry next render once data arrives.
    return { attempt: false, consumeKey: false };
  }
  return { attempt: true, consumeKey: true };
}

const ISO_WEEKDAY_FULL_TH_LABEL: Record<IsoWeekday, string> = {
  1: "จันทร์", 2: "อังคาร", 3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์", 7: "อาทิตย์",
};

/**
 * Composes date + weekday + time into one clean Thai label (Section 9 of
 * the V1.5B visual-obviousness hotfix) — never fabricated, always derived
 * from the real active TemporalSelection fields. The ONE shared composer
 * used by both the Crime Clock panel (drug_temporal_explorer_panel.tsx)
 * and the Network page's temporal-focus-restoration path, so the banner
 * text is identical whether the focus was just activated via "ดูบนผัง" or
 * reconstructed from a "กลับไปดูคดีตามช่วงเวลา" returnTo.
 *
 * `t` and `formatDate` are injected (not imported) to keep this module
 * dependency-free of the i18n/date-formatting layers — same convention
 * this codebase already uses for translateShortLabel-style parameters.
 */
export function composeTemporalSelectionLabel(
  selection: TemporalSelection,
  t: (key: never) => string,
  formatDate: (value: string) => string,
): string {
  const parts: string[] = [];
  if (selection.dateFrom || selection.dateTo) {
    if (selection.dateFrom && selection.dateTo) {
      parts.push(
        selection.dateFrom === selection.dateTo
          ? formatDate(selection.dateFrom)
          : `${formatDate(selection.dateFrom)}–${formatDate(selection.dateTo)}`,
      );
    } else if (selection.dateFrom) {
      parts.push(`${t("di.temporal.dateFrom" as never)} ${formatDate(selection.dateFrom)}`);
    } else {
      parts.push(`${t("di.temporal.dateTo" as never)} ${formatDate(selection.dateTo!)}`);
    }
  }
  if (selection.weekday != null) parts.push(`วัน${ISO_WEEKDAY_FULL_TH_LABEL[selection.weekday]}`);
  if (isTimeFilterActive(selection)) {
    const startH = String(Math.floor(selection.startMinute! / 60)).padStart(2, "0");
    const startM = String(selection.startMinute! % 60).padStart(2, "0");
    const endMinuteDisplay = selection.endMinute === 24 * 60 ? 0 : selection.endMinute!;
    const endH = String(Math.floor(endMinuteDisplay / 60)).padStart(2, "0");
    const endM = String(endMinuteDisplay % 60).padStart(2, "0");
    parts.push(`${startH}:${startM}–${endH}:${endM} น.`);
  }
  return parts.length > 0 ? parts.join(" · ") : t("di.temporal.selectedRangeNone" as never);
}
