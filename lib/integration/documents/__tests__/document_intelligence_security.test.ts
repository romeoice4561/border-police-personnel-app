import { test } from "node:test";
import assert from "node:assert/strict";

import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { reviewStatusFromExtractionResult } from "@/lib/intelligence/document_review_status";
import { fixtureDoc } from "@/lib/integration/documents/__tests__/test_fixtures";
import type { ExtractionPipelineResult } from "@/lib/extraction/extraction_pipeline_types";

const ASOF = new Date("2026-07-21");

test("the composed contract never contains a raw fingerprint, raw OCR text, or a national ID value — only counts/labels/enums", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 1 });
  const result: ExtractionPipelineResult = {
    status: "needs_review",
    providerUsed: "local_ocr",
    documentType: { type: "NATIONAL_ID", confidence: 0.9, matchedSignals: [], alternatives: [] },
    fields: [
      {
        code: "nationalId",
        label: "ID",
        rawValue: "1101200254896",
        normalizedValue: "1101200254896",
        normalizationReason: null,
        confidence: 0.9,
        validation: { valid: true, warnings: [] },
      },
    ],
    overallConfidence: 0.9,
    confidenceLevel: "high",
    aiFallbackReason: "NOT_REQUIRED",
    aiWasUsed: false,
    aiProviderModel: null,
    fromCache: false,
    processingStartedAt: new Date().toISOString(),
    processingCompletedAt: new Date().toISOString(),
    rulesVersion: "1.0.0",
    risk: { level: "SENSITIVE", reasons: [] },
    ocrQuality: null,
  };
  const review = reviewStatusFromExtractionResult(1, result);
  const composed = composeOfficerDocumentIntelligence({
    officerId: "test-officer",
    officerPk: 1,
    documents: [doc],
    reviewStatusByDocumentId: new Map([[1, review]]),
    asOf: ASOF,
  });

  const serialized = JSON.stringify(composed);
  assert.ok(!serialized.includes("1101200254896"), "the composed contract must never embed a raw national ID digit string");
  assert.ok(!serialized.includes("nationalId"), "field-level codes/raw values must never leak into the aggregate contract");

  // Structural check: the type only exposes counts/labels/enums/strings of
  // KNOWN document-type codes (e.g. "GP7") — never a field value.
  const allowedKeys = [
    "officerId",
    "readinessLevel",
    "readinessLabelTh",
    "completenessScore",
    "completenessLevel",
    "missingRequiredCount",
    "missingRequiredDocuments",
    "expiringSoonCount",
    "expiredCount",
    "pendingReviewCount",
    "unsupportedCount",
    "qualityWarningCount",
    "primaryAction",
    "primaryActionLabelTh",
    "drillDownQuery",
  ];
  assert.deepEqual(Object.keys(composed).sort(), allowedKeys.sort());
});

test("drillDownQuery never contains a document fingerprint or file hash — only enum-safe filter values", () => {
  const composed = composeOfficerDocumentIntelligence({ officerId: "test-officer", officerPk: 1, documents: [], asOf: ASOF });
  for (const value of Object.values(composed.drillDownQuery)) {
    assert.ok(value.length < 100, "drill-down query values must be short enum/id strings, never a SHA-256 fingerprint or long token");
  }
});
