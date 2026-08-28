/**
 * DI-8.2 — defendant count / unit count KPI tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrugGeoDefendantCount, computeDrugGeoUnitCount } from "@/lib/drug_intelligence/drug_geo_summary_extra";

test("defendant count is distinct persons across every marker, never double-counting a shared defendant", () => {
  const count = computeDrugGeoDefendantCount([
    { personSummaries: [{ personId: "a" }, { personId: "b" }] },
    { personSummaries: [{ personId: "b" }, { personId: "c" }] },
  ]);
  assert.equal(count, 3);
});

test("defendant count is 0 for an empty marker set, no crash", () => {
  assert.equal(computeDrugGeoDefendantCount([]), 0);
});

test("unit count is distinct non-blank reportingUnitText across cases", () => {
  const count = computeDrugGeoUnitCount([{ reportingUnitText: "กก.ตชด.41" }, { reportingUnitText: "กก.ตชด.41" }, { reportingUnitText: "กก.ตชด.42" }]);
  assert.equal(count, 2);
});

test("unit count excludes null and blank/whitespace-only reportingUnitText", () => {
  const count = computeDrugGeoUnitCount([{ reportingUnitText: null }, { reportingUnitText: "" }, { reportingUnitText: "   " }, { reportingUnitText: "กก.ตชด.41" }]);
  assert.equal(count, 1);
});

test("unit count is 0 for an empty case set, no crash", () => {
  assert.equal(computeDrugGeoUnitCount([]), 0);
});
