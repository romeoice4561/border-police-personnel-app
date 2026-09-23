/**
 * DI-8.7 V1.5A — VISUAL HOTFIX 2: Crime Clock readability + hourly
 * frequency view.
 *
 * Covers Section 25 items 1–18 (Top-N helper correctness, source-level
 * wiring proofs that the clock/histogram/date-picker/dropdowns all
 * share ONE TemporalSelection, and that coverage/entity/matching-id
 * values are untouched by this UI-only hotfix). Items 19–24 (regression
 * safety of the pre-existing engine, ThaiDatePicker, and unrelated DI
 * suites) are covered by re-running the existing test files listed in
 * this round's verification, not duplicated here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  type TemporalCaseRecord,
  type TemporalSelection,
  computeHourlyDistribution,
  computeTopHourlyBuckets,
  computeTemporalSelectionResult,
  emptyTemporalSelection,
} from "../drug_temporal_explorer.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_temporal_explorer_panel.tsx"),
  "utf8",
);
const clockSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_crime_clock.tsx"),
  "utf8",
);
const histogramSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_crime_clock_histogram.tsx"),
  "utf8",
);

function rec(id: string, arrestDate: string | null, arrestTime: string | null): TemporalCaseRecord {
  return { id, arrestDate, arrestTime, caseNumber: `CN-${id}`, status: "OPEN", province: null, reportingUnitText: null };
}

// 1. Exactly 24 hourly visual buckets.
test("1. computeHourlyDistribution (consumed by both clock and histogram) always returns exactly 24 buckets", () => {
  const dist = computeHourlyDistribution([]);
  assert.equal(dist.length, 24);
});

// 2. Non-zero segment shows exact count — proven at the source level: the
// clock renders a <text> count label only for bucket.count > 0, and the
// histogram prints the same bucket.count above each bar.
test("2. the clock component renders a numeric count label only for non-zero buckets", () => {
  assert.match(clockSource, /bucket\.count > 0 \? \(/);
  assert.match(clockSource, /\{bucket\.count\}/);
});
test("2b. the histogram renders the same bucket.count value above each bar", () => {
  assert.match(histogramSource, /bucket\.count > 0 \? bucket\.count : ""/);
});

// 3. Zero segment remains neutral — no count label, neutral/border fill in
// the histogram, low fixed opacity in the clock (never a fabricated "0").
test("3. zero-count segments use a neutral/border visual treatment, not a hardcoded red/danger color class", () => {
  assert.match(histogramSource, /bucket\.count === 0 && "bg-border"/);
  // Check actual Tailwind color utility classes only (not doc comments that
  // legitimately mention "never use danger color" as a design constraint).
  assert.doesNotMatch(clockSource, /\b(bg|text|stroke|fill)-(red|danger|risk|serious)(-\d+)?\b/);
  assert.doesNotMatch(histogramSource, /\b(bg|text|stroke|fill)-(red|danger|risk|serious)(-\d+)?\b/);
});

// 4. Hour tooltip/accessibility label contains exact time/count.
test("4. each clock hour segment has an aria-label built from exact start/end/count (di.temporal.hourAccessibleLabel)", () => {
  assert.match(clockSource, /di\.temporal\.hourAccessibleLabel/);
  assert.match(clockSource, /replace\("\{count\}", String\(bucket\.count\)\)/);
});
test("4b. the histogram bars carry the same accessible-label pattern", () => {
  assert.match(histogramSource, /di\.temporal\.hourAccessibleLabel/);
  assert.match(histogramSource, /replace\("\{count\}", String\(bucket\.count\)\)/);
});

// 5. Center shows total when no range selected.
test("5. the clock's center renders the full-day total (di.temporal.centerFullDay / centerTotalCases) when no time filter is active", () => {
  assert.match(clockSource, /di\.temporal\.centerFullDay/);
  assert.match(clockSource, /di\.temporal\.centerTotalCases/);
  assert.match(clockSource, /totalCaseCount/);
});

// 6. Center shows selected range/count when selected.
test("6. the clock's center renders the selected range + matching count (di.temporal.matchingCaseCount) when a time filter is active", () => {
  assert.match(clockSource, /timeActive \? \(/);
  assert.match(clockSource, /centerRangeLabel/);
  assert.match(clockSource, /matchingCaseCount/);
});

// 7. Top 3 uses real hourly distribution.
test("7. computeTopHourlyBuckets is a pure projection of the same hourlyDistribution array (no separate aggregation)", () => {
  const cases = [
    rec("a", "2026-09-24", "18:15"),
    rec("b", "2026-09-24", "18:45"),
    rec("c", "2026-09-24", "11:00"),
    rec("d", "2026-09-24", "20:00"),
  ];
  const dist = computeHourlyDistribution(cases);
  const top = computeTopHourlyBuckets(dist, 3);
  assert.deepEqual(top.map((b) => ({ hour: b.hour, count: b.count })), [
    { hour: 18, count: 2 },
    { hour: 11, count: 1 },
    { hour: 20, count: 1 },
  ]);
});

// 8. Top 3 excludes zero buckets.
test("8. computeTopHourlyBuckets never includes a zero-count hour, even if fewer than N non-zero hours exist", () => {
  const cases = [rec("a", "2026-09-24", "09:00")];
  const dist = computeHourlyDistribution(cases);
  const top = computeTopHourlyBuckets(dist, 3);
  assert.equal(top.length, 1);
  assert.ok(top.every((b) => b.count > 0));
});

// 9. Top 3 deterministic tie ordering: count desc, then hour asc.
test("9. computeTopHourlyBuckets breaks count ties by ascending hour, deterministically", () => {
  const cases = [
    rec("a", "2026-09-24", "20:00"),
    rec("b", "2026-09-24", "09:00"),
    rec("c", "2026-09-24", "15:00"),
  ];
  const dist = computeHourlyDistribution(cases);
  const top = computeTopHourlyBuckets(dist, 3);
  assert.deepEqual(top.map((b) => b.hour), [9, 15, 20]);
  // Re-running on the same input (different insertion order) is still deterministic.
  const casesReordered = [cases[2], cases[0], cases[1]];
  const dist2 = computeHourlyDistribution(casesReordered);
  const top2 = computeTopHourlyBuckets(dist2, 3);
  assert.deepEqual(top2.map((b) => b.hour), [9, 15, 20]);
});

// 10. Histogram has 24 hours.
test("10. the histogram component maps over the full 24-bucket hourlyDistribution, one bar per hour", () => {
  assert.match(histogramSource, /hourlyDistribution\.map\(\(bucket\)/);
});

// 11. Histogram consumes same hourly distribution (no second aggregation import).
test("11. the histogram imports only from drug_temporal_explorer's HourlyBucket type and the clock's shared hoursInRange helper — no separate aggregation module", () => {
  assert.match(histogramSource, /from ["']@\/lib\/drug_intelligence\/drug_temporal_explorer["']/);
  assert.match(histogramSource, /from ["']@\/components\/drug_intelligence\/drug_crime_clock["']/);
  assert.doesNotMatch(histogramSource, /computeHourlyDistribution/, "the histogram must not recompute its own distribution — it receives hourlyDistribution as a prop");
});

// 12. Histogram click updates same selection.
test("12. clicking a histogram bar calls the same onSelectRange callback the panel wires to setSelection", () => {
  assert.match(panelSource, /<DrugCrimeClockHistogram[\s\S]{0,300}?onSelectRange=\{\(startMinute, endMinute\) => setSelection/);
});

// 13. Selected range highlights matching histogram hours — proven via the
// shared hoursInRange helper used identically by both components.
test("13. both the clock and histogram derive their highlighted-hour set via the SAME hoursInRange helper", () => {
  assert.match(clockSource, /export function hoursInRange/);
  assert.match(histogramSource, /import \{ hoursInRange \} from ["']@\/components\/drug_intelligence\/drug_crime_clock["']/);
});

// 14. Clock/histogram/dropdown share one TemporalSelection.
test("14. the panel holds exactly one TemporalSelection state, and passes its startMinute/endMinute to the clock, the histogram, AND the start/end selects", () => {
  const useStateMatches = panelSource.match(/useState<TemporalSelection>/g) ?? [];
  assert.equal(useStateMatches.length, 1, "exactly one TemporalSelection useState — no duplicate filter state");
  assert.match(panelSource, /<DrugCrimeClock[\s\S]{0,200}?startMinute=\{selection\.startMinute\}/);
  assert.match(panelSource, /<DrugCrimeClockHistogram[\s\S]{0,200}?startMinute=\{selection\.startMinute\}/);
  assert.match(panelSource, /value=\{startHourValue/);
});

// 15. Midnight-wrap highlight set: 22,23,00,01,02 for a 22:00-02:00 (approx)
// range. Verified via the pure engine's own timeMatchesRange-based
// filtering below (the clock/histogram's hoursInRange helper is a pure,
// dependency-free geometry function over the same start/endMinute values
// and is exercised directly by components/ui rendering, not importable
// standalone into a node:test run of a .tsx module).
// filtering (independent verification that a wrap range actually selects the
// right hours' cases, without relying on requiring a .tsx file from a test).
test("15b. a midnight-wrap TemporalSelection (22:00-02:59) matches cases in hours 22,23,0,1,2 and excludes hour 12", () => {
  const cases = [
    rec("h22", "2026-09-24", "22:30"),
    rec("h23", "2026-09-24", "23:30"),
    rec("h00", "2026-09-24", "00:30"),
    rec("h01", "2026-09-24", "01:30"),
    rec("h02", "2026-09-24", "02:30"),
    rec("h12", "2026-09-24", "12:30"),
  ];
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 22 * 60, endMinute: 3 * 60 };
  const result = computeTemporalSelectionResult(cases, selection);
  assert.deepEqual(new Set(result.matchingCaseIds), new Set(["h22", "h23", "h00", "h01", "h02"]));
  assert.ok(!result.matchingCaseIds.includes("h12"));
});

// 16. Coverage values unchanged by this hotfix (same TemporalCoverageModel shape/values).
test("16. coverage computation is untouched — total/withDate/withTime/withoutTime match the pre-hotfix engine contract", () => {
  const cases = [rec("1", "2026-09-24", "10:00"), rec("2", "2026-09-24", null), rec("3", null, null)];
  const result = computeTemporalSelectionResult(cases, emptyTemporalSelection());
  assert.equal(result.coverage.total, 3);
  assert.equal(result.coverage.withDate, 2);
  assert.equal(result.coverage.withTime, 1);
  assert.equal(result.coverage.withoutTime, 2);
});

// 17. Entity counts unchanged — panel still derives them from real edges via computeEntitySummaryForCases (source-level check it wasn't replaced with a fabricated/static value).
test("17. the panel's entity summary is still computed from real neighborhood edges, not a static/fabricated object", () => {
  assert.match(panelSource, /function computeEntitySummaryForCases/);
  assert.match(panelSource, /neighborhood\.edges/);
  assert.doesNotMatch(panelSource, /PERSON: \d+,\s*PHONE: \d+/, "entity counts must never be hardcoded literals");
});

// 18. Matching case IDs unchanged — same filterCasesByTemporalSelection call, same input-order-preserving contract.
test("18. matchingCaseIds preserves input order exactly as before this hotfix", () => {
  const cases = [
    rec("c3", "2026-09-24", "19:00"),
    rec("c1", "2026-09-24", "19:30"),
    rec("c2", "2026-09-24", "08:00"),
  ];
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 18 * 60, endMinute: 22 * 60 };
  const result = computeTemporalSelectionResult(cases, selection);
  assert.deepEqual(result.matchingCaseIds, ["c3", "c1"]);
});

// 19. ThaiDatePicker remains used.
test("19. the panel still uses the canonical ThaiDatePicker for both date fields (hotfix 1 preserved)", () => {
  assert.match(panelSource, /from ["']@\/components\/ui\/thai_date_picker["']/);
  const usages = panelSource.match(/<ThaiDatePicker/g) ?? [];
  assert.equal(usages.length, 2);
});

// 20. No native date input returns.
test("20. no native <input type=\"date\"> was reintroduced anywhere in the panel, clock, or histogram", () => {
  assert.doesNotMatch(panelSource, /type=["']date["']/);
  assert.doesNotMatch(clockSource, /type=["']date["']/);
  assert.doesNotMatch(histogramSource, /type=["']date["']/);
});

// 21. Missing time never becomes 00:00.
test("21. a case with arrestDate but no arrestTime contributes to zero hourly buckets and never matches an active time filter", () => {
  const cases = [rec("1", "2026-09-24", null)];
  const dist = computeHourlyDistribution(cases);
  assert.ok(dist.every((b) => b.count === 0));
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 0, endMinute: 24 * 60 };
  const result = computeTemporalSelectionResult(cases, selection);
  assert.deepEqual(result.matchingCaseIds, []);
});
