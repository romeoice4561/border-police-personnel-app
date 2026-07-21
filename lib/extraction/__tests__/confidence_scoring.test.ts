import { test } from "node:test";
import assert from "node:assert/strict";

import { computeOverallConfidence } from "@/lib/extraction/confidence_scoring";
import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";

function field(code: string, normalizedValue: string | null, valid = true): ExtractedField {
  return {
    code,
    label: code,
    rawValue: normalizedValue,
    normalizedValue,
    normalizationReason: null,
    confidence: 0.8,
    validation: { valid, warnings: valid ? [] : ["invalid"] },
  };
}

test("returns null when OCR confidence itself is null (nothing measurable)", () => {
  const score = computeOverallConfidence({
    ocrConfidence0to100: null,
    documentTypeConfidence: 0.9,
    fields: [field("a", "x")],
    requiredFieldCodes: ["a"],
  });
  assert.equal(score, null);
});

test("perfect inputs (100% OCR, type match, all required fields present and valid) score near 1.0", () => {
  const score = computeOverallConfidence({
    ocrConfidence0to100: 100,
    documentTypeConfidence: 1,
    fields: [field("a", "x"), field("b", "y")],
    requiredFieldCodes: ["a", "b"],
  });
  assert.ok(score !== null && score > 0.95);
});

test("missing required fields lowers the score even with perfect OCR", () => {
  const withAllFields = computeOverallConfidence({
    ocrConfidence0to100: 100,
    documentTypeConfidence: 1,
    fields: [field("a", "x"), field("b", "y")],
    requiredFieldCodes: ["a", "b"],
  });
  const withMissingField = computeOverallConfidence({
    ocrConfidence0to100: 100,
    documentTypeConfidence: 1,
    fields: [field("a", "x"), field("b", null)],
    requiredFieldCodes: ["a", "b"],
  });
  assert.ok(withMissingField! < withAllFields!);
});

test("validation failures lower the score", () => {
  const allValid = computeOverallConfidence({
    ocrConfidence0to100: 90,
    documentTypeConfidence: 0.9,
    fields: [field("a", "x", true)],
    requiredFieldCodes: ["a"],
  });
  const oneInvalid = computeOverallConfidence({
    ocrConfidence0to100: 90,
    documentTypeConfidence: 0.9,
    fields: [field("a", "x", false)],
    requiredFieldCodes: ["a"],
  });
  assert.ok(oneInvalid! < allValid!);
});

test("zero required fields defaults completeness to 1 (nothing to be missing)", () => {
  const score = computeOverallConfidence({
    ocrConfidence0to100: 100,
    documentTypeConfidence: 1,
    fields: [],
    requiredFieldCodes: [],
  });
  assert.ok(score !== null && score > 0.9);
});

test("score is always clamped between 0 and 1", () => {
  const score = computeOverallConfidence({
    ocrConfidence0to100: 100,
    documentTypeConfidence: 1,
    fields: [field("a", "x")],
    requiredFieldCodes: ["a"],
  });
  assert.ok(score! >= 0 && score! <= 1);
});
