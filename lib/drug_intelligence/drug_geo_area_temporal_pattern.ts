/**
 * DI-8.5 — Area × Weekday × Time pattern summarization ("รูปแบบพื้นที่ ×
 * วัน × เวลา").
 *
 * Pure — no I/O. Derives entirely from the already-fetched, already-bounded
 * marker dataset (DrugMapResultView.markers, capped at MAP_MARKER_HARD_LIMIT
 * — see drug_map_query.ts) — no new server aggregation, no per-area query.
 *
 * Reuses the existing DI-8.2.1 temporal primitives (computeWeekdayFrequency,
 * computeTimeBucketFrequency, computeTemporalCoverage) so weekday/time
 * semantics — missing-arrestTime never fabricated into an hour bucket,
 * missing-arrestTime still counted for weekday/date analysis — stay
 * identical to every other temporal surface on this page. Never infers
 * motive, never claims future behavior, never labels an area "อันตราย" /
 * "เสี่ยงสูง" — descriptive recorded-data pattern summarization only.
 */

import {
  computeTemporalCoverage,
  computeTimeBucketFrequency,
  computeWeekdayFrequency,
  ISO_WEEKDAYS,
  MAP_TIME_BUCKETS,
  type IsoWeekday,
  type MapTimeBucketId,
  type TemporalCaseLite,
  type TemporalCoverage,
} from "@/lib/drug_intelligence/drug_map_temporal";

/**
 * Minimum recorded events an area needs to appear at all. Deliberately 1 —
 * this is a DISPLAY limit, not an intelligence/risk threshold (DI-8.5
 * UX-refinement round, Section 8): an area with 1–2 events is still real,
 * recorded data and must never be silently discarded as "insignificant".
 */
export const AREA_TEMPORAL_PATTERN_MIN_EVENTS = 1;
/** How many area rows show before the user opts into "ดูพื้นที่ทั้งหมด" — collapsed-by-default display limit, not a significance cutoff. */
export const AREA_TEMPORAL_INITIAL_LIMIT = 3;
/** Hard cap on how many area rows can ever render (even expanded) — keeps the section bounded regardless of how many provinces are in the filtered result. */
export const AREA_TEMPORAL_PATTERN_MAX_AREAS = 20;
/** Cap on how many case numbers preview per area row before collapsing to "+N". */
export const AREA_TEMPORAL_PATTERN_MAX_CASE_CHIPS = 3;

export interface AreaTemporalSourceRow extends TemporalCaseLite {
  caseNumber: string;
  province: string | null;
  district: string | null;
}

export interface AreaTemporalWeekdayRow {
  day: IsoWeekday;
  count: number;
}

export interface AreaTemporalTimeRow {
  bucket: MapTimeBucketId;
  count: number;
}

export interface AreaTemporalPattern {
  /** Display value — province name, or "ไม่ระบุจังหวัด" is never produced here (unspecified-province rows are excluded, see computeAreaTemporalPatterns). */
  province: string;
  eventCount: number;
  coverage: TemporalCoverage;
  /** Weekdays with >=1 recorded event, sorted by count desc then ISO weekday asc — ties broken deterministically, never by insertion order. */
  topWeekdays: AreaTemporalWeekdayRow[];
  /** Time buckets with >=1 recorded event, same ordering rule. */
  topTimeBuckets: AreaTemporalTimeRow[];
  /** Case numbers in this area, sorted, truncated to AREA_TEMPORAL_PATTERN_MAX_CASE_CHIPS (see caseNumberOverflowCount). */
  caseNumbers: string[];
  caseNumberOverflowCount: number;
  /** Total DISTINCT case numbers in this area (never fabricated — real dedup count, independent of the caseNumbers preview truncation). */
  uniqueCaseCount: number;
}

/**
 * Groups by province, ranks by event count desc, keeps areas with
 * >= AREA_TEMPORAL_PATTERN_MIN_EVENTS (1 — a display floor, not a
 * significance threshold), caps the full result at
 * AREA_TEMPORAL_PATTERN_MAX_AREAS. The UI further limits the INITIAL
 * (collapsed) view to AREA_TEMPORAL_INITIAL_LIMIT rows and lets the caller
 * expand to see the rest — see DrugGeoAreaTemporalPatternPanel.
 * Unspecified-province rows are excluded — "ไม่ระบุจังหวัด" is not a
 * meaningful geographic pattern to click-to-filter or feed to Section 9's
 * province-filter action.
 */
export function computeAreaTemporalPatterns(rows: readonly AreaTemporalSourceRow[]): AreaTemporalPattern[] {
  const byProvince = new Map<string, AreaTemporalSourceRow[]>();
  for (const row of rows) {
    const province = row.province?.trim();
    if (!province) continue;
    const list = byProvince.get(province);
    if (list) list.push(row);
    else byProvince.set(province, [row]);
  }

  const patterns: AreaTemporalPattern[] = [];
  for (const [province, provinceRows] of byProvince) {
    if (provinceRows.length < AREA_TEMPORAL_PATTERN_MIN_EVENTS) continue;

    const coverage = computeTemporalCoverage(provinceRows);
    const weekdayFrequency = computeWeekdayFrequency(provinceRows);
    const timeBucketFrequency = computeTimeBucketFrequency(provinceRows);

    const topWeekdays = ISO_WEEKDAYS.map((day) => ({ day, count: weekdayFrequency[day] ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.day - b.day);

    const topTimeBuckets = MAP_TIME_BUCKETS.map((b) => ({ bucket: b.id, count: timeBucketFrequency[b.id] ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket));

    const sortedCaseNumbers = [...new Set(provinceRows.map((r) => r.caseNumber))].sort((a, b) => a.localeCompare(b, "th"));
    const caseNumbers = sortedCaseNumbers.slice(0, AREA_TEMPORAL_PATTERN_MAX_CASE_CHIPS);
    const caseNumberOverflowCount = Math.max(0, sortedCaseNumbers.length - caseNumbers.length);

    patterns.push({
      province,
      eventCount: provinceRows.length,
      coverage,
      topWeekdays,
      topTimeBuckets,
      caseNumbers,
      caseNumberOverflowCount,
      uniqueCaseCount: sortedCaseNumbers.length,
    });
  }

  patterns.sort((a, b) => b.eventCount - a.eventCount || a.province.localeCompare(b.province, "th"));
  return patterns.slice(0, AREA_TEMPORAL_PATTERN_MAX_AREAS);
}
