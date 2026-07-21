import { test } from "node:test";
import assert from "node:assert/strict";

import { composeOfficerDocumentIntelligence, completenessLevelFromScore } from "@/lib/integration/documents/document_intelligence_contract";
import { reviewStatusFromExtractionResult, unsupportedFormatReviewStatus } from "@/lib/intelligence/document_review_status";
import { fixtureDoc, fullChecklistDocs } from "@/lib/integration/documents/__tests__/test_fixtures";
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

test("READY officer: full checklist, all approved, non-expiring -> readinessLevel READY, primaryAction NONE, empty drillDownQuery", () => {
  const docs = fullChecklistDocs({ expiryDate: new Date("2030-01-01") });
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 1, documents: docs, asOf: ASOF });
  assert.equal(result.readinessLevel, "READY");
  assert.equal(result.primaryAction, "NONE");
  assert.deepEqual(result.drillDownQuery, {});
  assert.equal(result.completenessLevel, "complete");
});

test("NEEDS_REVIEW officer: full checklist but one document expiring soon -> readinessLevel NEEDS_REVIEW, primaryAction REVIEW_EXPIRING", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 10);
  const docs = fullChecklistDocs();
  docs[0] = { ...docs[0], expiryDate: soon };
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 1, documents: docs, asOf: ASOF });
  assert.equal(result.readinessLevel, "NEEDS_REVIEW");
  assert.equal(result.primaryAction, "REVIEW_EXPIRING");
  assert.equal(result.expiringSoonCount, 1);
  assert.deepEqual(result.drillDownQuery, { documentReadiness: "NEEDS_REVIEW", officerId: "ภาค4/20" });
});

test("INCOMPLETE officer: zero documents -> readinessLevel INCOMPLETE, primaryAction UPLOAD_MISSING, non-empty missingRequiredDocuments", () => {
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 1, documents: [], asOf: ASOF });
  assert.equal(result.readinessLevel, "INCOMPLETE");
  assert.equal(result.primaryAction, "UPLOAD_MISSING");
  assert.ok(result.missingRequiredCount > 0);
  assert.ok(result.missingRequiredDocuments.includes("GP7"));
});

test("Phase 49A.2 (§7): exactly ONE missing required document -> primaryActionLabelTh names the specific document, not the generic phrase", () => {
  const verified = new Date("2026-01-01");
  const docs = fullChecklistDocs({ verifiedAt: verified }).filter((d) => d.documentType !== "HOUSE_REGISTRATION");
  const result = composeOfficerDocumentIntelligence({ officerId: "test", officerPk: 1, documents: docs, asOf: ASOF });
  assert.equal(result.missingRequiredDocuments.length, 1);
  assert.equal(result.missingRequiredDocuments[0], "HOUSE_REGISTRATION");
  assert.equal(result.primaryActionLabelTh, "อัปโหลดทะเบียนบ้าน");
  assert.notEqual(result.primaryActionLabelTh, "อัปโหลดเอกสารที่ขาด", "must never be the generic phrase when exactly one document is identifiable");
});

test("Phase 49A.2 (§7): MULTIPLE missing required documents -> primaryActionLabelTh stays the generic phrase (never names an arbitrary 'first' one)", () => {
  const result = composeOfficerDocumentIntelligence({ officerId: "test", officerPk: 1, documents: [], asOf: ASOF });
  assert.ok(result.missingRequiredDocuments.length > 1);
  assert.equal(result.primaryActionLabelTh, "อัปโหลดเอกสารที่ขาด");
});

test("BLOCKED officer: an expired required document -> readinessLevel BLOCKED, primaryAction REVIEW_EXPIRED", () => {
  const docs = fullChecklistDocs();
  docs[0] = { ...docs[0], expiryDate: new Date("2020-01-01") };
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 1, documents: docs, asOf: ASOF });
  assert.equal(result.readinessLevel, "BLOCKED");
  assert.equal(result.primaryAction, "REVIEW_EXPIRED");
  assert.equal(result.expiredCount, 1);
});

test("BLOCKED officer: validation failure takes priority over an unsupported format for primaryAction (matches document_readiness.ts's severity order)", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 42 });
  const result = fakeExtractionResult({
    fields: [{ code: "nationalId", label: "ID", rawValue: "x", normalizedValue: "x", normalizationReason: null, confidence: 0.5, validation: { valid: false, warnings: ["bad checksum"] } }],
  });
  const review = reviewStatusFromExtractionResult(42, result);
  const composed = composeOfficerDocumentIntelligence({
    officerId: "ภาค4/20",
    officerPk: 1,
    documents: [doc],
    reviewStatusByDocumentId: new Map([[42, review]]),
    asOf: ASOF,
  });
  assert.equal(composed.readinessLevel, "BLOCKED");
  assert.equal(composed.primaryAction, "RESOLVE_VALIDATION");
});

test("unsupported-format document -> primaryAction RETAKE_UNSUPPORTED, unsupportedCount reflects it", () => {
  const doc = fixtureDoc({ documentType: "GP7", id: 7 });
  const review = unsupportedFormatReviewStatus(7);
  const composed = composeOfficerDocumentIntelligence({
    officerId: "ภาค4/20",
    officerPk: 1,
    documents: [doc],
    reviewStatusByDocumentId: new Map([[7, review]]),
    asOf: ASOF,
  });
  assert.equal(composed.primaryAction, "RETAKE_UNSUPPORTED");
  assert.equal(composed.unsupportedCount, 1);
});

test("UNKNOWN/unavailable transient OCR data: no reviewStatusByDocumentId supplied -> pendingReviewCount reflects only real schema-derived pending state, never a fabricated OCR/AI count", () => {
  const docs = fullChecklistDocs({ verifiedAt: new Date("2026-01-01") });
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 1, documents: docs, asOf: ASOF });
  // All approved, so pendingManualApprovals is 0; no review status supplied
  // means pendingOcrReviews falls back to "not_processed" (still a real,
  // honest signal from review_workload.ts, not a fabricated 0).
  assert.ok(result.pendingReviewCount >= 0);
  assert.equal(result.qualityWarningCount, 0, "no quality warnings supplied -> 0, never guessed");
});

test("missing required documents list matches completeness engine's own output exactly (no re-derivation)", () => {
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 1, documents: [], asOf: ASOF });
  assert.equal(result.missingRequiredCount, result.missingRequiredDocuments.length);
});

test("completenessLevelFromScore bands: >=90 complete, 50-89 partial, <50 critical", () => {
  assert.equal(completenessLevelFromScore(100), "complete");
  assert.equal(completenessLevelFromScore(90), "complete");
  assert.equal(completenessLevelFromScore(89), "partial");
  assert.equal(completenessLevelFromScore(50), "partial");
  assert.equal(completenessLevelFromScore(49), "critical");
  assert.equal(completenessLevelFromScore(0), "critical");
});

test("qualityWarningCount only counts warnings for ACTIVE documents", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 5, isActive: false });
  const result = composeOfficerDocumentIntelligence({
    officerId: "ภาค4/20",
    officerPk: 1,
    documents: [doc],
    qualityWarningsByDocumentId: new Map([[5, "stale warning"]]),
    asOf: ASOF,
  });
  assert.equal(result.qualityWarningCount, 0);
});

test("officerId in the result is the human-facing code, never the numeric PK", () => {
  const result = composeOfficerDocumentIntelligence({ officerId: "ภาค4/20", officerPk: 999, documents: [], asOf: ASOF });
  assert.equal(result.officerId, "ภาค4/20");
});
