/**
 * Tests for the DI-3.1 seized-item analytics domain contract — gram/
 * kilogram conversion and the resolveDrugSeizedItemAnalyticsView() facade
 * a future Commander Dashboard (DI-8) would consume directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gramsToKilograms, kilogramsToGrams, resolveDrugSeizedItemAnalyticsView } from "@/lib/drug_intelligence/drug_seized_item_analytics";

test("gramsToKilograms converts the canonical persisted unit to the display unit", () => {
  assert.equal(gramsToKilograms(642750), 642.75);
  assert.equal(gramsToKilograms(1000), 1);
  assert.equal(gramsToKilograms(0), 0);
});

test("kilogramsToGrams is the exact inverse — the boundary conversion the Create Case UI applies before persistence", () => {
  assert.equal(kilogramsToGrams(3.25), 3250);
  assert.equal(kilogramsToGrams(642.75), 642750);
});

test("resolveDrugSeizedItemAnalyticsView for a MASS row exposes both grams and the kilogram presentation value", () => {
  const view = resolveDrugSeizedItemAnalyticsView({
    drugCategory: "CRYSTAL_METHAMPHETAMINE",
    otherDrugCategoryLabel: null,
    measurementKind: "MASS",
    normalizedCount: null,
    normalizedWeightGrams: 642750,
  });
  assert.equal(view.categoryLabelTh, "ไอซ์");
  assert.equal(view.measurementKindLabelTh, "น้ำหนัก");
  assert.equal(view.normalizedWeightKilograms, 642.75);
  assert.equal(view.normalizedCount, null);
});

test("resolveDrugSeizedItemAnalyticsView for a COUNT row leaves the weight fields null — never fabricates a mass total for a tablet count", () => {
  const view = resolveDrugSeizedItemAnalyticsView({
    drugCategory: "METHAMPHETAMINE_TABLET",
    otherDrugCategoryLabel: null,
    measurementKind: "COUNT",
    normalizedCount: 8420350,
    normalizedWeightGrams: null,
  });
  assert.equal(view.categoryLabelTh, "ยาบ้า");
  assert.equal(view.normalizedWeightGrams, null);
  assert.equal(view.normalizedWeightKilograms, null);
  assert.equal(view.normalizedCount, 8420350);
});

test("resolveDrugSeizedItemAnalyticsView for OTHER preserves the free-text label without making it the category key", () => {
  const view = resolveDrugSeizedItemAnalyticsView({
    drugCategory: "OTHER",
    otherDrugCategoryLabel: "สารสังเคราะห์ชนิดใหม่",
    measurementKind: "MASS",
    normalizedCount: null,
    normalizedWeightGrams: 500,
  });
  assert.equal(view.drugCategory, "OTHER");
  assert.equal(view.otherDrugCategoryLabel, "สารสังเคราะห์ชนิดใหม่");
  assert.equal(view.categoryLabelTh, "อื่น ๆ");
});
