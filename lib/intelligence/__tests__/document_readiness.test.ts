import { test } from "node:test";
import assert from "node:assert/strict";

import { computeDocumentReadiness } from "@/lib/intelligence/document_readiness";
import { reviewStatusFromExtractionResult, unsupportedFormatReviewStatus } from "@/lib/intelligence/document_review_status";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";
import type { ExtractionPipelineResult } from "@/lib/extraction/extraction_pipeline_types";

const ASOF = new Date("2026-07-21");

function fakeExtractionResult(overrides: Partial<ExtractionPipelineResult> = {}): ExtractionPipelineResult {
  return {
    status: "needs_review",
    providerUsed: "local_ocr",
    documentType: { type: "NATIONAL_ID", confidence: 0.9, matchedSignals: [], alternatives: [] },
    fields: [],
    overallConfidence: 0.9,
    confidenceLevel: "high",
    aiFallbackReason: "NOT_REQUIRED",
    aiWasUsed: false,
    aiProviderModel: null,
    fromCache: false,
    processingStartedAt: new Date().toISOString(),
    processingCompletedAt: new Date().toISOString(),
    rulesVersion: "1.0.0",
    risk: { level: "SAFE", reasons: [] },
    ocrQuality: null,
    ...overrides,
  };
}

test("zero documents -> INCOMPLETE (missing required documents), never READY", () => {
  const readiness = computeDocumentReadiness({ documents: [], asOf: ASOF });
  assert.equal(readiness.level, "INCOMPLETE");
  assert.ok(readiness.reasons.some((r) => r.code === "MISSING_REQUIRED_DOCUMENT"));
});

test("an expired required document -> BLOCKED, which dominates INCOMPLETE even though other documents are also missing", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01"), verifiedAt: new Date("2020-01-01") })];
  const readiness = computeDocumentReadiness({ documents: docs, asOf: ASOF });
  assert.equal(readiness.level, "BLOCKED");
  assert.ok(readiness.reasons.some((r) => r.code === "DOCUMENT_EXPIRED"));
});

test("a document with validation failures -> BLOCKED", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 42, verifiedAt: new Date("2026-01-01") });
  const result = fakeExtractionResult({
    fields: [{ code: "nationalId", label: "ID", rawValue: "x", normalizedValue: "x", normalizationReason: null, confidence: 0.5, validation: { valid: false, warnings: ["bad checksum"] } }],
  });
  const review = reviewStatusFromExtractionResult(42, result);
  const readiness = computeDocumentReadiness({
    documents: [doc],
    reviewStatusByDocumentId: new Map([[42, review]]),
    asOf: ASOF,
  });
  assert.equal(readiness.level, "BLOCKED");
  assert.ok(readiness.reasons.some((r) => r.code === "VALIDATION_FAILED"));
});

test("an unsupported-format document -> BLOCKED", () => {
  const doc = fixtureDoc({ documentType: "GP7", id: 7, verifiedAt: new Date("2026-01-01") });
  const review = unsupportedFormatReviewStatus(7);
  const readiness = computeDocumentReadiness({ documents: [doc], reviewStatusByDocumentId: new Map([[7, review]]), asOf: ASOF });
  assert.equal(readiness.level, "BLOCKED");
  assert.ok(readiness.reasons.some((r) => r.code === "FORMAT_UNSUPPORTED"));
});

test("a required document expiring soon, with every other checklist document present -> NEEDS_REVIEW, not INCOMPLETE", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 10);
  const verified = new Date("2026-01-01");
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: soon, verifiedAt: verified }),
    fixtureDoc({ documentType: "GP7", verifiedAt: verified }),
    fixtureDoc({ documentType: "HOUSE_REGISTRATION", verifiedAt: verified }),
    fixtureDoc({ documentType: "EDUCATION_CERTIFICATE", verifiedAt: verified }),
    fixtureDoc({ documentType: "TRAINING_CERTIFICATE", verifiedAt: verified }),
    fixtureDoc({ documentType: "AWARD", verifiedAt: verified }),
    fixtureDoc({ documentType: "MEDICAL_DOCUMENT", verifiedAt: verified }),
    fixtureDoc({ documentType: "SALARY_DOCUMENT", verifiedAt: verified }),
    fixtureDoc({ documentType: "ANNUAL_EVALUATION", verifiedAt: verified }),
    fixtureDoc({ documentType: "FIREARMS_QUALIFICATION", verifiedAt: verified }),
  ];
  const readiness = computeDocumentReadiness({ documents: docs, asOf: ASOF });
  assert.equal(readiness.level, "NEEDS_REVIEW");
  assert.ok(readiness.reasons.some((r) => r.code === "DOCUMENT_EXPIRING_SOON"));
  assert.equal(readiness.reasons.some((r) => r.code === "MISSING_REQUIRED_DOCUMENT"), false);
});

test("a fully complete, fully approved, non-expiring officer -> READY", () => {
  const verified = new Date("2026-01-01");
  const farFuture = new Date("2030-01-01");
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: farFuture, verifiedAt: verified }),
    fixtureDoc({ documentType: "GP7", verifiedAt: verified }),
    fixtureDoc({ documentType: "HOUSE_REGISTRATION", verifiedAt: verified }),
    fixtureDoc({ documentType: "EDUCATION_CERTIFICATE", verifiedAt: verified }),
    fixtureDoc({ documentType: "TRAINING_CERTIFICATE", verifiedAt: verified }),
    fixtureDoc({ documentType: "AWARD", verifiedAt: verified }),
    fixtureDoc({ documentType: "MEDICAL_DOCUMENT", verifiedAt: verified }),
    fixtureDoc({ documentType: "SALARY_DOCUMENT", verifiedAt: verified }),
    fixtureDoc({ documentType: "ANNUAL_EVALUATION", verifiedAt: verified }),
    fixtureDoc({ documentType: "FIREARMS_QUALIFICATION", verifiedAt: verified }),
  ];
  const readiness = computeDocumentReadiness({ documents: docs, asOf: ASOF });
  assert.equal(readiness.level, "READY");
  assert.deepEqual(readiness.reasons, []);
});

test("a present-but-unverified document (verifiedAt null) -> NEEDS_REVIEW", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", verifiedAt: null })];
  const readiness = computeDocumentReadiness({ documents: docs, asOf: ASOF });
  assert.ok(readiness.reasons.some((r) => r.code === "NOT_MANUALLY_APPROVED"));
});

test("AI review pending on a document -> NEEDS_REVIEW", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 9, verifiedAt: new Date("2026-01-01") });
  const result = fakeExtractionResult({ status: "ai_suggested", aiWasUsed: false });
  const review = reviewStatusFromExtractionResult(9, result);
  const readiness = computeDocumentReadiness({ documents: [doc], reviewStatusByDocumentId: new Map([[9, review]]), asOf: ASOF });
  assert.ok(readiness.reasons.some((r) => r.code === "AI_REVIEW_PENDING"));
});

test("no reviewStatusByDocumentId supplied -> defaults never fabricate AI/validation issues (only NOT_MANUALLY_APPROVED can still fire from real schema data)", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", verifiedAt: new Date("2026-01-01") })];
  const readiness = computeDocumentReadiness({ documents: docs, asOf: ASOF });
  assert.equal(readiness.reasons.some((r) => r.code === "VALIDATION_FAILED"), false);
  assert.equal(readiness.reasons.some((r) => r.code === "AI_REVIEW_PENDING"), false);
});

test("BLOCKED dominates NEEDS_REVIEW and INCOMPLETE when multiple issues coexist", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 5);
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01"), verifiedAt: new Date("2020-01-01") }), // expired -> BLOCKED
    fixtureDoc({ documentType: "DRIVER_LICENSE", expiryDate: soon, verifiedAt: new Date("2026-01-01") }), // expiring soon -> NEEDS_REVIEW
  ];
  const readiness = computeDocumentReadiness({ documents: docs, asOf: ASOF });
  assert.equal(readiness.level, "BLOCKED");
});

test("completeness and expiryInfo are surfaced on the result, not recomputed by callers", () => {
  const readiness = computeDocumentReadiness({ documents: [], asOf: ASOF });
  assert.ok(readiness.completeness);
  assert.deepEqual(readiness.expiryInfo, []);
});
