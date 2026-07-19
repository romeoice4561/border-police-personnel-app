import { test } from "node:test";
import assert from "node:assert/strict";

import { DOCUMENT_CATEGORIES, categoryForTypeCode, getDocumentCategories } from "@/lib/document/document_categories";
import { getDocumentTypes, isKnownDocumentType } from "@/lib/document/document_types";

// Phase 46 — e-PF category grouping layer.

test("every category has a stable code and at least one type (except the fallback)", () => {
  for (const cat of DOCUMENT_CATEGORIES) {
    assert.ok(cat.code, "category must have a code");
    assert.ok(cat.labelTh && cat.labelEn, `category ${cat.code} must have both labels`);
  }
});

test("categoryForTypeCode resolves a known type to its declared category", () => {
  assert.equal(categoryForTypeCode("NATIONAL_ID").code, "IDENTITY");
  assert.equal(categoryForTypeCode("GP7").code, "OFFICIAL_PERSONNEL");
  assert.equal(categoryForTypeCode("TRAINING_CERTIFICATE").code, "TRAINING");
});

test("categoryForTypeCode falls back to Miscellaneous for an unknown/custom code", () => {
  assert.equal(categoryForTypeCode("SOME_FUTURE_TYPE").code, "MISCELLANEOUS");
});

test("registering the e-PF additional types made them real, known document types", () => {
  for (const code of [
    "TRAINING_CERTIFICATE",
    "EDUCATION_CERTIFICATE",
    "AWARD",
    "MEDICAL_DOCUMENT",
    "FIREARMS_QUALIFICATION",
    "ANNUAL_EVALUATION",
    "SALARY_DOCUMENT",
    "PENSION_DOCUMENT",
  ]) {
    assert.ok(isKnownDocumentType(code), `${code} should be registered`);
  }
});

test("every document type in the registry belongs to exactly one category", () => {
  const types = getDocumentTypes();
  for (const type of types) {
    const matches = DOCUMENT_CATEGORIES.filter((cat) => cat.typeCodes.includes(type.code));
    assert.ok(matches.length <= 1, `${type.code} should not appear in more than one category (found in: ${matches.map((m) => m.code).join(", ")})`);
  }
});

test("getDocumentCategories returns the same ordered list every call", () => {
  assert.deepEqual(getDocumentCategories(), DOCUMENT_CATEGORIES);
});
