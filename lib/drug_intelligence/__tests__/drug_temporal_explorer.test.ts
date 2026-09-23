/**
 * DI-8.7 V1.5A — Temporal Explorer / Crime Clock pure-engine tests.
 *
 * Covers Section 28 items A–V: arrestTime propagation safety, hourly
 * distribution correctness, time-range semantics (normal + midnight
 * wrap), date-only exclusion from active time filters, weekday +
 * date-range + time intersection (AND semantics), coverage totals,
 * determinism, exact matching-case-id sets, clear/reset, and semantic
 * safety (no risk-language in this module's own strings).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type TemporalCaseRecord,
  type TemporalSelection,
  emptyTemporalSelection,
  isTimeFilterActive,
  isSelectionEmpty,
  clearTimeSelection,
  resetTemporalSelection,
  caseMatchesDateRange,
  caseMatchesTemporalSelection,
  filterCasesByTemporalSelection,
  computeTemporalCoverageModel,
  computeHourlyDistribution,
  computeTemporalWeekdayFrequency,
  computeTemporalSelectionResult,
} from "../drug_temporal_explorer.js";

function rec(id: string, arrestDate: string | null, arrestTime: string | null, extra?: Partial<TemporalCaseRecord>): TemporalCaseRecord {
  return {
    id,
    arrestDate,
    arrestTime,
    caseNumber: `CN-${id}`,
    status: "OPEN",
    province: null,
    reportingUnitText: null,
    ...extra,
  };
}

// A. Real arrestTime passes through — trivially true since TemporalCaseRecord carries it directly;
//    the actual graph-metadata wiring is covered in drug_network_graph_insights.test.ts /
//    drug_network_graph_flow_adapter.test.ts fixtures. Here we confirm the engine reads it faithfully.
test("A. a case with a real arrestTime is counted in its hour bucket", () => {
  const cases = [rec("1", "2026-01-05", "18:30")];
  const dist = computeHourlyDistribution(cases);
  assert.equal(dist[18].count, 1);
  assert.deepEqual(dist[18].caseIds, ["1"]);
});

// B. Missing arrestTime remains null/missing — never counted anywhere time-based.
test("B. a case with arrestTime=null contributes to zero hourly buckets", () => {
  const cases = [rec("1", "2026-01-05", null)];
  const dist = computeHourlyDistribution(cases);
  assert.ok(dist.every((b) => b.count === 0));
});

// C. Missing time never becomes 00:00.
test("C. missing arrestTime is never coerced into hour 0 (00:00)", () => {
  const cases = [rec("1", "2026-01-05", null), rec("2", "2026-01-06", null)];
  const dist = computeHourlyDistribution(cases);
  assert.equal(dist[0].count, 0, "hour 0 must stay empty — missing time is not 00:00");
});

// D. 24 hourly buckets exist.
test("D. computeHourlyDistribution always returns exactly 24 buckets, hour 0..23", () => {
  const dist = computeHourlyDistribution([]);
  assert.equal(dist.length, 24);
  assert.deepEqual(dist.map((b) => b.hour), Array.from({ length: 24 }, (_, i) => i));
});

// E. 00:00 belongs to hour 0 only when a REAL recorded time.
test("E. a real recorded 00:00 arrestTime lands in hour 0", () => {
  const cases = [rec("1", "2026-01-05", "00:00")];
  const dist = computeHourlyDistribution(cases);
  assert.equal(dist[0].count, 1);
  assert.deepEqual(dist[0].caseIds, ["1"]);
});

// F. 23:59 belongs to hour 23.
test("F. arrestTime 23:59 lands in hour 23, not overflowing to a 24th bucket", () => {
  const cases = [rec("1", "2026-01-05", "23:59")];
  const dist = computeHourlyDistribution(cases);
  assert.equal(dist[23].count, 1);
});

// G. Normal time range 18:00–22:00.
test("G. normal (non-wrapping) time range 18:00-22:00 matches times inside it and excludes times outside", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 18 * 60, endMinute: 22 * 60 };
  assert.equal(caseMatchesTemporalSelection(rec("1", "2026-01-05", "19:00"), selection), true);
  assert.equal(caseMatchesTemporalSelection(rec("2", "2026-01-05", "17:59"), selection), false);
  assert.equal(caseMatchesTemporalSelection(rec("3", "2026-01-05", "22:01"), selection), false);
});

// H. Midnight wrap 22:00-02:00.
test("H. midnight-wrap time range 22:00-02:00 matches times >= 22:00 OR <= 02:00", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 22 * 60, endMinute: 2 * 60 };
  assert.equal(caseMatchesTemporalSelection(rec("1", "2026-01-05", "23:30"), selection), true);
  assert.equal(caseMatchesTemporalSelection(rec("2", "2026-01-05", "01:00"), selection), true);
  assert.equal(caseMatchesTemporalSelection(rec("3", "2026-01-05", "12:00"), selection), false);
});

// I. Date-only case excluded from active time filter.
test("I. a case with arrestDate but no arrestTime is excluded once a time filter is active", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 0, endMinute: 24 * 60 };
  assert.equal(caseMatchesTemporalSelection(rec("1", "2026-01-05", null), selection), false);
});

// J. Date-only case remains in weekday/date analysis (no time filter active).
test("J. a case with arrestDate but no arrestTime remains eligible for date-range and weekday filtering", () => {
  const dateOnly: TemporalSelection = { dataset: "ARREST_TIME", dateFrom: "2026-01-01", dateTo: "2026-01-31" };
  assert.equal(caseMatchesTemporalSelection(rec("1", "2026-01-05", null), dateOnly), true);
  // 2026-01-05 is a Monday (ISO weekday 1)
  const weekdayOnly: TemporalSelection = { dataset: "ARREST_TIME", weekday: 1 };
  assert.equal(caseMatchesTemporalSelection(rec("2", "2026-01-05", null), weekdayOnly), true);
});

// K. Weekday filter.
test("K. weekday filter matches only cases falling on the selected ISO weekday", () => {
  const cases = [
    rec("mon", "2026-01-05", "10:00"), // Monday
    rec("tue", "2026-01-06", "10:00"), // Tuesday
  ];
  const selection: TemporalSelection = { dataset: "ARREST_TIME", weekday: 1 };
  const result = filterCasesByTemporalSelection(cases, selection);
  assert.deepEqual(result.map((c) => c.id), ["mon"]);
});

// L. Weekday + time intersection.
test("L. weekday AND time-range intersect (both must match)", () => {
  const cases = [
    rec("sat-evening", "2026-01-10", "19:00"), // Saturday
    rec("sat-morning", "2026-01-10", "08:00"), // Saturday, wrong time
    rec("sun-evening", "2026-01-11", "19:00"), // Sunday, wrong weekday
  ];
  const selection: TemporalSelection = { dataset: "ARREST_TIME", weekday: 6, startMinute: 18 * 60, endMinute: 22 * 60 };
  const result = filterCasesByTemporalSelection(cases, selection);
  assert.deepEqual(result.map((c) => c.id), ["sat-evening"]);
});

// M. Date-range + weekday + time intersection.
test("M. date-range AND weekday AND time-range all intersect together", () => {
  const cases = [
    rec("in-range", "2026-01-10", "19:00"), // Saturday, in Jan range, in time window
    rec("out-of-date-range", "2026-02-07", "19:00"), // Saturday, Feb (out of range), in time window
    rec("wrong-weekday", "2026-01-11", "19:00"), // Sunday
    rec("wrong-time", "2026-01-10", "08:00"), // Saturday, wrong time
  ];
  const selection: TemporalSelection = {
    dataset: "ARREST_TIME",
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    weekday: 6,
    startMinute: 18 * 60,
    endMinute: 22 * 60,
  };
  const result = filterCasesByTemporalSelection(cases, selection);
  assert.deepEqual(result.map((c) => c.id), ["in-range"]);
});

// N. Coverage totals.
test("N. computeTemporalCoverageModel reports total/withDate/withoutDate/withTime/withoutTime correctly", () => {
  const cases = [
    rec("1", "2026-01-01", "10:00"),
    rec("2", "2026-01-02", null),
    rec("3", null, null),
  ];
  const coverage = computeTemporalCoverageModel(cases);
  assert.equal(coverage.total, 3);
  assert.equal(coverage.withDate, 2);
  assert.equal(coverage.withoutDate, 1);
  assert.equal(coverage.withTime, 1);
  assert.equal(coverage.withoutTime, 2);
});

// O. Deterministic input-order independence (same input twice yields identical output).
test("O. computeTemporalSelectionResult is deterministic across repeated calls on the same input", () => {
  const cases = [rec("1", "2026-01-05", "19:00"), rec("2", "2026-01-06", "08:00")];
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 18 * 60, endMinute: 22 * 60 };
  const a = computeTemporalSelectionResult(cases, selection);
  const b = computeTemporalSelectionResult(cases, selection);
  assert.deepEqual(a, b);
});

// P. Selected case IDs exact, and preserve input order.
test("P. matchingCaseIds preserves the input array's order and contains exactly the matching ids", () => {
  const cases = [
    rec("c3", "2026-01-05", "19:00"),
    rec("c1", "2026-01-05", "19:30"),
    rec("c2", "2026-01-05", "08:00"), // excluded by time
  ];
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 18 * 60, endMinute: 22 * 60 };
  const result = computeTemporalSelectionResult(cases, selection);
  assert.deepEqual(result.matchingCaseIds, ["c3", "c1"]);
  assert.equal(result.matchingCaseCount, 2);
});

// Q. Clear time selection.
test("Q. clearTimeSelection removes only startMinute/endMinute, keeping date/weekday filters intact", () => {
  const selection: TemporalSelection = {
    dataset: "ARREST_TIME",
    dateFrom: "2026-01-01",
    weekday: 6,
    startMinute: 60,
    endMinute: 120,
  };
  const cleared = clearTimeSelection(selection);
  assert.equal(isTimeFilterActive(cleared), false);
  assert.equal(cleared.dateFrom, "2026-01-01");
  assert.equal(cleared.weekday, 6);
});

// R. Full 24-hour / full reset.
test("R. resetTemporalSelection returns a fully empty selection", () => {
  const reset = resetTemporalSelection();
  assert.equal(isSelectionEmpty(reset), true);
  assert.deepEqual(reset, emptyTemporalSelection());
});

// S. No risk-language output — this module never emits any user-facing string
// (that's the UI layer's job), so we assert its own source contains none of
// the forbidden risk-framing terms (Section 24), guarding against future drift.
test("S. the pure engine module's source contains no risk/danger-framing language", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "drug_temporal_explorer.ts"), "utf8");
  for (const forbidden of ["ช่วงอันตราย", "ช่วงเสี่ยง", "เวลาที่คนร้ายชอบก่อเหตุ", "เวลาที่เครือข่ายเคลื่อนไหว", "ช่วงก่อเหตุยอดนิยม"]) {
    assert.doesNotMatch(src, new RegExp(forbidden));
  }
});

// T. No relationship-semantic mutation / no schema-adjacent behavior — this
// module never imports Prisma, the DB layer, or graph edge-kind/relationship
// vocabulary; it only consumes plain case records.
test("T. the pure engine has no DB/Prisma/React imports and does not reference DrugGraphEdgeKind", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "drug_temporal_explorer.ts"), "utf8");
  assert.doesNotMatch(src, /from ["']react["']/);
  assert.doesNotMatch(src, /@prisma\/client/);
  assert.doesNotMatch(src, /DrugGraphEdgeKind/);
});

// U. weekday frequency wrapper reuses the canonical computeWeekdayFrequency (no second engine).
test("U. computeTemporalWeekdayFrequency matches the canonical per-weekday counts", () => {
  const cases = [rec("1", "2026-01-05", "10:00"), rec("2", "2026-01-05", "11:00"), rec("3", "2026-01-06", "10:00")];
  const freq = computeTemporalWeekdayFrequency(cases);
  assert.equal(freq[1], 2); // Monday
  assert.equal(freq[2], 1); // Tuesday
});

// V. date-range boundaries are inclusive, and a case entirely outside the range is excluded.
test("V. caseMatchesDateRange is inclusive on both ends and excludes cases outside the range", () => {
  assert.equal(caseMatchesDateRange("2026-01-01", "2026-01-01", "2026-01-31"), true);
  assert.equal(caseMatchesDateRange("2026-01-31", "2026-01-01", "2026-01-31"), true);
  assert.equal(caseMatchesDateRange("2026-02-01", "2026-01-01", "2026-01-31"), false);
  assert.equal(caseMatchesDateRange(null, "2026-01-01", "2026-01-31"), false, "date filter active -> dateless case excluded");
});
