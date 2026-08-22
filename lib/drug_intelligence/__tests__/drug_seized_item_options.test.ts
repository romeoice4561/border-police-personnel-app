/**
 * Tests for the DI-3.1 drugCategory/measurementKind option lists — the
 * closed-set guards and the label/default-kind maps have full coverage for
 * every enum value.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DRUG_CATEGORIES,
  DRUG_CATEGORY_LABELS,
  DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND,
  DRUG_MEASUREMENT_KINDS,
  isValidDrugCategory,
  isValidDrugMeasurementKind,
} from "@/lib/drug_intelligence/drug_seized_item_options";

test("isValidDrugCategory accepts every catalogued value and rejects unknown input", () => {
  for (const category of DRUG_CATEGORIES) {
    assert.equal(isValidDrugCategory(category), true);
  }
  assert.equal(isValidDrugCategory("FENTANYL"), false);
  assert.equal(isValidDrugCategory(""), false);
});

test("isValidDrugMeasurementKind accepts COUNT/MASS and rejects anything else", () => {
  for (const kind of DRUG_MEASUREMENT_KINDS) {
    assert.equal(isValidDrugMeasurementKind(kind), true);
  }
  assert.equal(isValidDrugMeasurementKind("WEIGHT"), false);
});

test("every drug category has a bilingual label — never a missing/undefined entry a UI would render blank", () => {
  for (const category of DRUG_CATEGORIES) {
    const label = DRUG_CATEGORY_LABELS[category];
    assert.ok(label.labelTh.length > 0, `${category} missing Thai label`);
    assert.ok(label.labelEn.length > 0, `${category} missing English label`);
  }
});

test("every drug category has a default measurement kind for the Create Case UX default", () => {
  for (const category of DRUG_CATEGORIES) {
    assert.ok(DRUG_MEASUREMENT_KINDS.includes(DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND[category]));
  }
});

test("OTHER's canonical label is never the freeform substance name — that lives in otherDrugCategoryLabel, not this map", () => {
  assert.equal(DRUG_CATEGORY_LABELS.OTHER.labelTh, "อื่น ๆ");
});
