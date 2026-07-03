import { test } from "node:test";
import assert from "node:assert/strict";
import { TimelineNormalizer } from "@/lib/normalize/timeline_normalizer";
import type { TimelineEntry } from "@/lib/types/vision";

test("sorts timeline entries newest to oldest", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [
    { year: "2018", position: "Officer", unit: "Unit A" },
    { year: "2022", position: "Chief", unit: "Unit C" },
    { year: "2020", position: "Supervisor", unit: "Unit B" },
  ];

  const result = normalizer.normalize(timeline);
  assert.deepEqual(
    result.map((e) => e.year),
    ["2022", "2020", "2018"]
  );
});

test("entries with a 'present' marker sort first (most recent)", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [
    { year: "2018", position: "Officer", unit: "Unit A" },
    { year: "ปัจจุบัน", position: "Chief", unit: "Unit C" },
    { year: "2020", position: "Supervisor", unit: "Unit B" },
  ];

  const result = normalizer.normalize(timeline);
  assert.equal(result[0].year, "ปัจจุบัน");
  assert.deepEqual(
    result.map((e) => e.year),
    ["ปัจจุบัน", "2020", "2018"]
  );
});

test("removes exact duplicate rows (identical year, position, unit)", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [
    { year: "2018", position: "Officer", unit: "Unit A" },
    { year: "2018", position: "Officer", unit: "Unit A" },
    { year: "2020", position: "Supervisor", unit: "Unit B" },
  ];

  const result = normalizer.normalize(timeline);
  assert.equal(result.length, 2);
});

test("does not remove entries that differ only in position or unit", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [
    { year: "2018", position: "Officer", unit: "Unit A" },
    { year: "2018", position: "Senior Officer", unit: "Unit A" },
  ];

  const result = normalizer.normalize(timeline);
  assert.equal(result.length, 2);
});

test("converts Thai numeral years within timeline entries", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [{ year: "พ.ศ.๒๕๖๗", position: "Officer", unit: "Unit A" }];

  const result = normalizer.normalize(timeline);
  assert.equal(result[0].year, "2567");
  assert.equal(result[0].display_year, "พ.ศ.2567");
});

test("missing unit is preserved as missing, never invented", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [{ year: "2018", position: "Officer", unit: "" }];

  const result = normalizer.normalize(timeline);
  assert.equal(result[0].unit, "");
});

test("null unit stays null", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [{ year: "2018", position: "Officer", unit: null }];

  const result = normalizer.normalize(timeline);
  assert.equal(result[0].unit, null);
});

test("does not mutate the input array or its entries", () => {
  const normalizer = new TimelineNormalizer();
  const timeline: TimelineEntry[] = [
    { year: "2018", position: "  Officer  ", unit: "Unit A" },
    { year: "2020", position: "Chief", unit: "Unit B" },
  ];
  const snapshot = JSON.parse(JSON.stringify(timeline));

  normalizer.normalize(timeline);

  assert.deepEqual(timeline, snapshot);
});
