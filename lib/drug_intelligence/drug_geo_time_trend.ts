/**
 * Monthly case-count trend for the Map Analysis Workspace (Phase DI-8.2,
 * Section 12).
 *
 * Client-side aggregation over an ALREADY-FETCHED DrugGeoResultView — no new
 * API endpoint, no new backend aggregation. The geo service already returns
 * every matching case's arrestDate (both marker-backed and no-coordinate
 * cases — Section 19/20: a case without coordinates must not be silently
 * excluded from non-map analytics), so trend counting reuses that data
 * as-is rather than re-querying.
 *
 * Metric is case COUNT only (Section 12 explicitly forbids charting
 * incompatible seizure units on one axis) — never a seizure-quantity trend.
 *
 * Pure — no I/O, no React.
 */

export interface DrugGeoTimeTrendBucket {
  /** "2026-01" — sortable, locale-independent key. */
  monthKey: string;
  /** 1-12 */
  month: number;
  /** Calendar year (Gregorian, internal) the bucket's month belongs to. */
  year: number;
  caseCount: number;
}

interface TrendCaseInput {
  arrestDate: string | null;
}

/**
 * Buckets cases by calendar month (UTC) of arrestDate, sorted chronologically.
 * Cases with a null/unparseable arrestDate are excluded from the trend
 * (never guessed into a bucket — same "never fabricate a date" convention
 * DI-7.7's training-history sort already established) — the caller may
 * still show a separate "ไม่ทราบวันที่" count if useful, this function only
 * returns the dated buckets.
 */
export function computeDrugGeoMonthlyTrend(cases: TrendCaseInput[]): DrugGeoTimeTrendBucket[] {
  const buckets = new Map<string, DrugGeoTimeTrendBucket>();

  for (const c of cases) {
    if (!c.arrestDate) continue;
    const d = new Date(c.arrestDate);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const existing = buckets.get(monthKey);
    if (existing) {
      existing.caseCount += 1;
    } else {
      buckets.set(monthKey, { monthKey, month, year, caseCount: 1 });
    }
  }

  return [...buckets.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

const MONTH_LABEL_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_LABEL_EN = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function drugGeoTrendMonthLabel(bucket: DrugGeoTimeTrendBucket, language: "th" | "en"): string {
  return language === "th" ? MONTH_LABEL_TH[bucket.month] : MONTH_LABEL_EN[bucket.month];
}
