/**
 * DI-8.2.1 — Map temporal helper contracts (3-hour buckets).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caseMatchesTimeFilter,
  caseMatchesWeekdays,
  computeTemporalCoverage,
  computeTimeBucketFrequency,
  computeWeekdayFrequency,
  filterCasesByTime,
  filterCasesByWeekdays,
  isoWeekdayFromDateOnly,
  mapTimeBucketChipLabel,
  minutesFromArrestTime,
  parseHhMmToMinutes,
  parseWeekdaysParam,
  resolveTimeFilterBounds,
  serializeWeekdaysParam,
  timeBucketForMinute,
  timeMatchesRange,
  type TemporalCaseLite,
} from "@/lib/drug_intelligence/drug_map_temporal";

test("weekday: Monday / Sunday from DATE-only", () => {
  assert.equal(isoWeekdayFromDateOnly("2026-08-10"), 1); // Mon
  assert.equal(isoWeekdayFromDateOnly("2026-08-09"), 7); // Sun
  assert.equal(isoWeekdayFromDateOnly("2026-08-01"), 6); // Sat
});

test("weekday URL serialize/parse Friday+Saturday = 5,6", () => {
  assert.equal(serializeWeekdaysParam([5, 6]), "5,6");
  assert.deepEqual(parseWeekdaysParam("5,6"), [5, 6]);
  assert.deepEqual(parseWeekdaysParam(""), []);
  assert.equal(serializeWeekdaysParam([]), undefined);
});

test("weekday multi-select Fri+Sat", () => {
  assert.equal(caseMatchesWeekdays("2026-08-07", [5, 6]), true); // Fri
  assert.equal(caseMatchesWeekdays("2026-08-08", [5, 6]), true); // Sat
  assert.equal(caseMatchesWeekdays("2026-08-10", [5, 6]), false); // Mon
  assert.equal(caseMatchesWeekdays("2026-08-10", []), true); // ทุกวัน
  assert.equal(caseMatchesWeekdays(null, [5]), false);
});

test("3-hour bucket boundaries (exact matrix)", () => {
  const cases: Array<[number, string]> = [
    [0, "H00_03"],
    [2 * 60 + 59, "H00_03"],
    [3 * 60, "H03_06"],
    [5 * 60 + 59, "H03_06"],
    [6 * 60, "H06_09"],
    [8 * 60 + 59, "H06_09"],
    [9 * 60, "H09_12"],
    [11 * 60 + 59, "H09_12"],
    [12 * 60, "H12_15"],
    [14 * 60 + 59, "H12_15"],
    [15 * 60, "H15_18"],
    [17 * 60 + 59, "H15_18"],
    [18 * 60, "H18_21"],
    [20 * 60 + 59, "H18_21"],
    [21 * 60, "H21_24"],
    [23 * 60 + 59, "H21_24"],
  ];
  for (const [minute, expected] of cases) {
    assert.equal(timeBucketForMinute(minute), expected, `minute ${minute}`);
  }
});

test("bucket chip labels never store 24:00 as HH:MM clock value", () => {
  assert.equal(mapTimeBucketChipLabel("H21_24"), "21:00–24:00");
  assert.equal(mapTimeBucketChipLabel("H00_03"), "00:00–03:00");
});

test("custom same-day 08:30–14:00", () => {
  const bounds = resolveTimeFilterBounds("CUSTOM", "08:30", "14:00");
  assert.ok(bounds);
  assert.equal(timeMatchesRange(8 * 60 + 30, bounds!.startMinute, bounds!.endMinute, { endInclusive: true }), true);
  assert.equal(timeMatchesRange(14 * 60, bounds!.startMinute, bounds!.endMinute, { endInclusive: true }), true);
  assert.equal(timeMatchesRange(14 * 60 + 1, bounds!.startMinute, bounds!.endMinute, { endInclusive: true }), false);
  assert.equal(timeMatchesRange(7 * 60, bounds!.startMinute, bounds!.endMinute, { endInclusive: true }), false);
});

test("overnight custom 20:00–02:00 is valid", () => {
  const bounds = resolveTimeFilterBounds("CUSTOM", "20:00", "02:00");
  assert.ok(bounds);
  assert.ok(bounds!.startMinute > bounds!.endMinute);
  assert.equal(caseMatchesTimeFilter("20:00", bounds), true);
  assert.equal(caseMatchesTimeFilter("23:59", bounds), true);
  assert.equal(caseMatchesTimeFilter("00:00", bounds), true);
  assert.equal(caseMatchesTimeFilter("01:59", bounds), true);
  assert.equal(caseMatchesTimeFilter("02:00", bounds), false);
  assert.equal(caseMatchesTimeFilter("12:00", bounds), false);
});

test("missing arrestTime never becomes 00:00 and is excluded when time filter active", () => {
  assert.equal(minutesFromArrestTime(null), null);
  assert.equal(minutesFromArrestTime(""), null);
  assert.equal(minutesFromArrestTime("00:00"), 0);
  const bounds = resolveTimeFilterBounds("H21_24");
  assert.equal(caseMatchesTimeFilter(null, bounds), false);
  assert.equal(caseMatchesTimeFilter(null, null), true);
});

test("coverage 16 total / 9 with time → 56.3%", () => {
  const cases: TemporalCaseLite[] = [];
  for (let i = 0; i < 9; i++) cases.push({ id: `t${i}`, arrestDate: "2026-08-01", arrestTime: "21:00" });
  for (let i = 0; i < 7; i++) cases.push({ id: `u${i}`, arrestDate: "2026-08-01", arrestTime: null });
  const cov = computeTemporalCoverage(cases);
  assert.equal(cov.total, 16);
  assert.equal(cov.withTime, 9);
  assert.equal(cov.withoutTime, 7);
  assert.equal(cov.coveragePercent, 56.3);
});

test("time bucket frequency ignores unknown time (3-hour)", () => {
  const cases: TemporalCaseLite[] = [
    { id: "1", arrestDate: "2026-08-01", arrestTime: "21:00" },
    { id: "2", arrestDate: "2026-08-01", arrestTime: "21:30" },
    { id: "3", arrestDate: "2026-08-01", arrestTime: null },
    { id: "4", arrestDate: "2026-08-01", arrestTime: "09:00" },
  ];
  const freq = computeTimeBucketFrequency(cases);
  assert.equal(freq.H21_24, 2);
  assert.equal(freq.H09_12, 1);
  assert.equal(freq.H00_03, 0);
  assert.equal(freq.H18_21, 0);
});

test("weekday frequency counts DATE-only cases", () => {
  const cases: TemporalCaseLite[] = [
    { id: "1", arrestDate: "2026-08-07", arrestTime: null }, // Fri
    { id: "2", arrestDate: "2026-08-07", arrestTime: "10:00" }, // Fri
    { id: "3", arrestDate: "2026-08-08", arrestTime: null }, // Sat
  ];
  const freq = computeWeekdayFrequency(cases);
  assert.equal(freq[5], 2);
  assert.equal(freq[6], 1);
});

test("filter composition date+weekday+time (H21_24)", () => {
  const cases: TemporalCaseLite[] = [
    { id: "fri-night", arrestDate: "2026-08-07", arrestTime: "21:00" },
    { id: "fri-day", arrestDate: "2026-08-07", arrestTime: "10:00" },
    { id: "fri-unknown", arrestDate: "2026-08-07", arrestTime: null },
    { id: "sat-night", arrestDate: "2026-08-08", arrestTime: "22:00" },
    { id: "mon-night", arrestDate: "2026-08-10", arrestTime: "21:00" },
  ];
  const afterWeekday = filterCasesByWeekdays(cases, [5, 6]);
  assert.equal(afterWeekday.length, 4);
  const bounds = resolveTimeFilterBounds("H21_24");
  const afterTime = filterCasesByTime(afterWeekday, bounds);
  assert.deepEqual(
    afterTime.map((c) => c.id).sort(),
    ["fri-night", "sat-night"],
  );
});

test("parseHhMmToMinutes supports 24:00 end sentinel internally; picker stores 00–23 only", () => {
  assert.equal(parseHhMmToMinutes("24:00"), 1440);
  assert.equal(parseHhMmToMinutes("23:59"), 23 * 60 + 59);
});
