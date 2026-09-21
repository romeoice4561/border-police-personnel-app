/**
 * DI-8.5 — Area × Weekday × Time pattern summarization.
 *
 * Run:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_geo_area_temporal_pattern.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAreaTemporalPatterns,
  AREA_TEMPORAL_PATTERN_MIN_EVENTS,
  AREA_TEMPORAL_INITIAL_LIMIT,
  AREA_TEMPORAL_PATTERN_MAX_AREAS,
  AREA_TEMPORAL_PATTERN_MAX_CASE_CHIPS,
  type AreaTemporalSourceRow,
} from "@/lib/drug_intelligence/drug_geo_area_temporal_pattern";

function row(overrides: Partial<AreaTemporalSourceRow> & { id: string }): AreaTemporalSourceRow {
  return {
    caseNumber: overrides.id,
    arrestDate: "2026-03-06", // Friday
    arrestTime: "19:00",
    province: "ชุมพร",
    district: null,
    ...overrides,
  };
}

// A. area temporal calculations remain correct
test("A: eventCount, weekday and time-bucket calculations are correct for a real dataset", () => {
  const rows = [
    row({ id: "A", arrestDate: "2026-03-06", arrestTime: "19:00" }), // Fri, H18_21
    row({ id: "B", arrestDate: "2026-03-06", arrestTime: "10:00" }), // Fri, H09_12
    row({ id: "C", arrestDate: "2026-03-07", arrestTime: "22:00" }), // Sat, H21_24
  ];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.eventCount, 3);
  assert.equal(patterns[0]!.topWeekdays.find((w) => w.day === 5)!.count, 2); // Friday
  assert.equal(patterns[0]!.topWeekdays.find((w) => w.day === 6)!.count, 1); // Saturday
  assert.equal(patterns[0]!.topTimeBuckets.find((b) => b.bucket === "H18_21")!.count, 1);
  assert.equal(patterns[0]!.topTimeBuckets.find((b) => b.bucket === "H09_12")!.count, 1);
  assert.equal(patterns[0]!.topTimeBuckets.find((b) => b.bucket === "H21_24")!.count, 1);
});

// B. area results sorted by event count
test("B: patterns are ranked by eventCount desc, then province name for ties", () => {
  const rows = [
    ...Array.from({ length: 2 }, (_, i) => row({ id: `low-${i}`, province: "ระนอง" })),
    ...Array.from({ length: 6 }, (_, i) => row({ id: `high-${i}`, province: "ชุมพร" })),
  ];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.province, "ชุมพร");
  assert.equal(patterns[0]!.eventCount, 6);
  assert.equal(patterns[1]!.province, "ระนอง");
  assert.equal(patterns[1]!.eventCount, 2);
});

// C. top 3 initial display behavior — this is a UI concern (AREA_TEMPORAL_INITIAL_LIMIT),
// verified here at the constant/data level: the full computed list is NOT itself capped at 3.
test("C: AREA_TEMPORAL_INITIAL_LIMIT is 3, but computeAreaTemporalPatterns returns more than 3 when more areas qualify", () => {
  assert.equal(AREA_TEMPORAL_INITIAL_LIMIT, 3);
  const provinces = ["ก", "ข", "ค", "ง", "จ"];
  const rows = provinces.flatMap((p, i) => Array.from({ length: 5 - i }, (_, n) => row({ id: `${p}-${n}`, province: p })));
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns.length, 5, "all 5 qualifying areas are returned by the data layer; the UI decides how many to show initially");
});

// D. areas with 1–2 events are not falsely discarded as "insignificant"
test("D: an area with exactly 1 event is included — display limit is 1, not a significance threshold", () => {
  assert.equal(AREA_TEMPORAL_PATTERN_MIN_EVENTS, 1);
  const rows = [row({ id: "A", province: "สุราษฎร์ธานี" })];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0]!.province, "สุราษฎร์ธานี");
  assert.equal(patterns[0]!.eventCount, 1);
});

test("D2: an area with 2 events is included alongside a larger area, both present in the result", () => {
  const rows = [
    row({ id: "A", province: "ชุมพร" }),
    row({ id: "B", province: "ชุมพร" }),
    row({ id: "C", province: "ชุมพร" }),
    row({ id: "D", province: "ระนอง" }),
    row({ id: "E", province: "ระนอง" }),
  ];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns.length, 2);
  const ranong = patterns.find((p) => p.province === "ระนอง")!;
  assert.equal(ranong.eventCount, 2);
});

// E. unique related-case count
test("E: uniqueCaseCount reflects the real distinct case count, independent of the truncated preview", () => {
  const rows = Array.from({ length: 9 }, (_, i) => row({ id: `DI-TEST-${String(i).padStart(3, "0")}` }));
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.uniqueCaseCount, 9);
});

test("E2: duplicate markers for the same case number count once toward uniqueCaseCount", () => {
  const rows = [row({ id: "DI-TEST-001" }), row({ id: "DI-TEST-001" }), row({ id: "DI-TEST-002" })];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.eventCount, 3, "eventCount is per-marker");
  assert.equal(patterns[0]!.uniqueCaseCount, 2, "uniqueCaseCount is per-distinct-case");
});

// F. maximum 3 case previews
test("F: caseNumbers preview is capped at AREA_TEMPORAL_PATTERN_MAX_CASE_CHIPS (3)", () => {
  assert.equal(AREA_TEMPORAL_PATTERN_MAX_CASE_CHIPS, 3);
  const rows = Array.from({ length: 9 }, (_, i) => row({ id: `DI-TEST-${String(i).padStart(3, "0")}` }));
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.caseNumbers.length, 3);
});

// G. correct +N
test("G: caseNumberOverflowCount is the exact remainder beyond the 3-item preview", () => {
  const rows = Array.from({ length: 9 }, (_, i) => row({ id: `DI-TEST-${String(i).padStart(3, "0")}` }));
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.caseNumberOverflowCount, 6);
  assert.equal(patterns[0]!.caseNumbers.length + patterns[0]!.caseNumberOverflowCount, patterns[0]!.uniqueCaseCount);
});

test("G2: no overflow when unique case count is within the preview cap", () => {
  const rows = [row({ id: "A" }), row({ id: "B" })];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.caseNumberOverflowCount, 0);
  assert.equal(patterns[0]!.caseNumbers.length, 2);
});

// H. only weekdays count > 0 rendered
test("H: topWeekdays never includes a weekday with zero recorded events", () => {
  const rows = [row({ id: "A" }), row({ id: "B" }), row({ id: "C" })]; // all same Friday
  const patterns = computeAreaTemporalPatterns(rows);
  assert.ok(patterns[0]!.topWeekdays.every((w) => w.count > 0));
  assert.equal(patterns[0]!.topWeekdays.length, 1);
});

// I. only time buckets count > 0 rendered
test("I: topTimeBuckets never includes a bucket with zero recorded events", () => {
  const rows = [row({ id: "A", arrestTime: "19:00" }), row({ id: "B", arrestTime: "19:30" })];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.ok(patterns[0]!.topTimeBuckets.every((b) => b.count > 0));
  assert.equal(patterns[0]!.topTimeBuckets.length, 1);
});

// J. missing arrestTime never enters time bucket
test("J: missing arrestTime is excluded from every time bucket, but still counted in coverage.withoutTime", () => {
  const rows = [row({ id: "A", arrestTime: "19:00" }), row({ id: "B", arrestTime: null }), row({ id: "C", arrestTime: null })];
  const patterns = computeAreaTemporalPatterns(rows);
  const totalBucketed = patterns[0]!.topTimeBuckets.reduce((sum, b) => sum + b.count, 0);
  assert.equal(totalBucketed, 1, "only the row with a real arrestTime is bucketed");
  assert.equal(patterns[0]!.coverage.total, 3);
  assert.equal(patterns[0]!.coverage.withTime, 1);
  assert.equal(patterns[0]!.coverage.withoutTime, 2);
});

// (retained from the original suite — still valid under the new threshold)
test("unspecified province (null/empty) is excluded — never a meaningful click-to-filter target", () => {
  const rows = [row({ id: "A", province: null }), row({ id: "B", province: "" }), row({ id: "C", province: "  " })];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns.length, 0);
});

test("patterns are capped at AREA_TEMPORAL_PATTERN_MAX_AREAS even when more provinces qualify", () => {
  assert.equal(AREA_TEMPORAL_PATTERN_MAX_AREAS, 20);
  const provinces = Array.from({ length: 25 }, (_, i) => `P${i}`);
  const rows = provinces.flatMap((p, i) => [row({ id: `${p}-a`, province: p }), row({ id: `${p}-b-${i}`, province: p })]);
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns.length, 20);
});

test("missing arrestDate is excluded from topWeekdays but does not crash and the event still counts toward eventCount", () => {
  const rows = [row({ id: "A" }), row({ id: "B" }), row({ id: "C", arrestDate: null })];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns[0]!.eventCount, 3);
  const totalWeekdayCounted = patterns[0]!.topWeekdays.reduce((sum, w) => sum + w.count, 0);
  assert.equal(totalWeekdayCounted, 2, "the date-less row must never be assigned a fabricated weekday");
});

test("multiple provinces each produce independent, correctly-scoped patterns (no cross-area leakage)", () => {
  const rows = [
    row({ id: "A", province: "ชุมพร", arrestDate: "2026-03-06" }), // Friday
    row({ id: "B", province: "ชุมพร", arrestDate: "2026-03-06" }),
    row({ id: "C", province: "ชุมพร", arrestDate: "2026-03-06" }),
    row({ id: "D", province: "ระนอง", arrestDate: "2026-03-07" }), // Saturday
    row({ id: "E", province: "ระนอง", arrestDate: "2026-03-07" }),
    row({ id: "F", province: "ระนอง", arrestDate: "2026-03-07" }),
  ];
  const patterns = computeAreaTemporalPatterns(rows);
  assert.equal(patterns.length, 2);
  const chumphon = patterns.find((p) => p.province === "ชุมพร")!;
  const ranong = patterns.find((p) => p.province === "ระนอง")!;
  assert.equal(chumphon.topWeekdays[0]!.day, 5);
  assert.equal(ranong.topWeekdays[0]!.day, 6);
  assert.ok(!chumphon.caseNumbers.includes("D"));
  assert.ok(!ranong.caseNumbers.includes("A"));
});

test("empty input produces an empty pattern list, never a crash", () => {
  assert.deepEqual(computeAreaTemporalPatterns([]), []);
});
