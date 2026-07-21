import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyDocumentRisk } from "@/lib/extraction/risk_classification";

test("UNKNOWN document type is always NEEDS_REVIEW, regardless of confidence", () => {
  const r = classifyDocumentRisk({ documentType: "UNKNOWN", confidenceLevel: "high", hasValidationFailures: false });
  assert.equal(r.level, "NEEDS_REVIEW");
});

test("NATIONAL_ID is always SENSITIVE, even at high confidence with no validation failures", () => {
  const r = classifyDocumentRisk({ documentType: "NATIONAL_ID", confidenceLevel: "high", hasValidationFailures: false });
  assert.equal(r.level, "SENSITIVE");
});

test("PASSPORT, DRIVER_LICENSE, MEDICAL_DOCUMENT, SALARY_DOCUMENT are all SENSITIVE", () => {
  for (const type of ["PASSPORT", "DRIVER_LICENSE", "MEDICAL_DOCUMENT", "SALARY_DOCUMENT"] as const) {
    const r = classifyDocumentRisk({ documentType: type, confidenceLevel: "high", hasValidationFailures: false });
    assert.equal(r.level, "SENSITIVE", `${type} should be SENSITIVE`);
  }
});

test("TRAINING_CERTIFICATE at high confidence with no failures is SAFE", () => {
  const r = classifyDocumentRisk({ documentType: "TRAINING_CERTIFICATE", confidenceLevel: "high", hasValidationFailures: false });
  assert.equal(r.level, "SAFE");
});

test("a normally-safe type becomes NEEDS_REVIEW when validation failed", () => {
  const r = classifyDocumentRisk({ documentType: "AWARD", confidenceLevel: "high", hasValidationFailures: true });
  assert.equal(r.level, "NEEDS_REVIEW");
});

test("a normally-safe type becomes NEEDS_REVIEW at low confidence", () => {
  const r = classifyDocumentRisk({ documentType: "EDUCATION_CERTIFICATE", confidenceLevel: "low", hasValidationFailures: false });
  assert.equal(r.level, "NEEDS_REVIEW");
});

test("a recognized type outside both lists defaults to NEEDS_REVIEW, never guessed SAFE", () => {
  const r = classifyDocumentRisk({ documentType: "ANNUAL_EVALUATION", confidenceLevel: "high", hasValidationFailures: false });
  assert.equal(r.level, "NEEDS_REVIEW");
});

test("classification always includes at least one reason except for a clean SAFE result", () => {
  const safe = classifyDocumentRisk({ documentType: "TRAINING_CERTIFICATE", confidenceLevel: "high", hasValidationFailures: false });
  assert.equal(safe.reasons.length, 0);
  const sensitive = classifyDocumentRisk({ documentType: "NATIONAL_ID", confidenceLevel: "high", hasValidationFailures: false });
  assert.ok(sensitive.reasons.length > 0);
});
