/**
 * DI-8.2 — monthly case-count trend tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrugGeoMonthlyTrend, drugGeoTrendMonthLabel } from "@/lib/drug_intelligence/drug_geo_time_trend";

test("groups cases into monthly buckets, sorted chronologically", () => {
  const trend = computeDrugGeoMonthlyTrend([
    { arrestDate: "2026-03-05T00:00:00.000Z" },
    { arrestDate: "2026-01-10T00:00:00.000Z" },
    { arrestDate: "2026-03-20T00:00:00.000Z" },
    { arrestDate: "2026-02-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(
    trend.map((b) => b.monthKey),
    ["2026-01", "2026-02", "2026-03"]
  );
  assert.equal(trend.find((b) => b.monthKey === "2026-03")?.caseCount, 2);
});

test("cases with a null arrestDate are excluded, never guessed into a bucket", () => {
  const trend = computeDrugGeoMonthlyTrend([{ arrestDate: null }, { arrestDate: "2026-01-01T00:00:00.000Z" }]);
  assert.equal(trend.length, 1);
  assert.equal(trend[0].caseCount, 1);
});

test("cases with an unparseable arrestDate are excluded, never crash", () => {
  const trend = computeDrugGeoMonthlyTrend([{ arrestDate: "not-a-date" }, { arrestDate: "2026-01-01T00:00:00.000Z" }]);
  assert.equal(trend.length, 1);
});

test("empty input produces an empty trend, no crash", () => {
  assert.deepEqual(computeDrugGeoMonthlyTrend([]), []);
});

test("drugGeoTrendMonthLabel returns Thai and English month abbreviations", () => {
  const bucket = { monthKey: "2026-10", month: 10, year: 2026, caseCount: 1 };
  assert.equal(drugGeoTrendMonthLabel(bucket, "th"), "ต.ค.");
  assert.equal(drugGeoTrendMonthLabel(bucket, "en"), "Oct");
});
