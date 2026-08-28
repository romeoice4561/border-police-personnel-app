/**
 * DI-8.2 — filtered-map-result seizure summary tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { combineDrugGeoSeizureGroups } from "@/lib/drug_intelligence/drug_geo_seizure_summary";
import type { DrugGeoSeizureGroup } from "@/lib/drug_intelligence/drug_geo_marker";

function countGroup(overrides: Partial<DrugGeoSeizureGroup> = {}): DrugGeoSeizureGroup {
  return {
    drugCategory: "METHAMPHETAMINE_TABLET",
    categoryLabelTh: "ยาบ้า",
    measurementKind: "COUNT",
    totalCount: 1000,
    totalWeightGrams: null,
    totalWeightKilograms: null,
    displayUnit: "เม็ด",
    displayTh: "ยาบ้า 1,000 เม็ด",
    ...overrides,
  };
}

function massGroup(overrides: Partial<DrugGeoSeizureGroup> = {}): DrugGeoSeizureGroup {
  return {
    drugCategory: "CRYSTAL_METHAMPHETAMINE",
    categoryLabelTh: "ไอซ์",
    measurementKind: "MASS",
    totalCount: null,
    totalWeightGrams: 2400,
    totalWeightKilograms: 2.4,
    displayUnit: null,
    displayTh: "ไอซ์ 2.4 กก.",
    ...overrides,
  };
}

test("sums COUNT groups of the same category+unit across multiple cases", () => {
  const result = combineDrugGeoSeizureGroups([[countGroup({ totalCount: 1000 })], [countGroup({ totalCount: 4000 })]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].totalCount, 5000);
  assert.equal(result[0].displayTh, "ยาบ้า 5,000 เม็ด");
});

test("sums MASS groups of the same category across multiple cases, in grams then converts to kg", () => {
  const result = combineDrugGeoSeizureGroups([[massGroup({ totalWeightGrams: 2400 })], [massGroup({ totalWeightGrams: 10000 })]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].totalWeightGrams, 12400);
  assert.equal(result[0].totalWeightKilograms, 12.4);
});

test("never combines COUNT and MASS for the same drug category into one number", () => {
  const result = combineDrugGeoSeizureGroups([
    [countGroup({ drugCategory: "METHAMPHETAMINE_TABLET", categoryLabelTh: "ยาบ้า", totalCount: 5000 })],
    [massGroup({ drugCategory: "METHAMPHETAMINE_TABLET", categoryLabelTh: "ยาบ้า", totalWeightGrams: 1200 })],
  ]);
  assert.equal(result.length, 2);
  const count = result.find((g) => g.measurementKind === "COUNT");
  const mass = result.find((g) => g.measurementKind === "MASS");
  assert.equal(count?.totalCount, 5000);
  assert.equal(mass?.totalWeightKilograms, 1.2);
});

test("COUNT rows with different stored display units never merge", () => {
  const result = combineDrugGeoSeizureGroups([[countGroup({ displayUnit: "เม็ด", totalCount: 5000 })], [countGroup({ displayUnit: "ขวด", totalCount: 10 })]]);
  assert.equal(result.length, 2);
});

test("empty input produces an empty summary, no crash", () => {
  assert.deepEqual(combineDrugGeoSeizureGroups([]), []);
  assert.deepEqual(combineDrugGeoSeizureGroups([[], []]), []);
});

test("always derives totalWeightKilograms from totalWeightGrams, never trusts a stale precomputed value", () => {
  const result = combineDrugGeoSeizureGroups([[massGroup({ totalWeightGrams: 3000, totalWeightKilograms: 999 })]]);
  assert.equal(result[0].totalWeightKilograms, 3);
});

test("different drug categories never merge even with the same measurement kind", () => {
  const result = combineDrugGeoSeizureGroups([[countGroup({ drugCategory: "METHAMPHETAMINE_TABLET" })], [countGroup({ drugCategory: "MDMA", categoryLabelTh: "ยาอี" })]]);
  assert.equal(result.length, 2);
});
