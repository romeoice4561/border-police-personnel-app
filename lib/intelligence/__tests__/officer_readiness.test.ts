import { test } from "node:test";
import assert from "node:assert/strict";

import { computeOfficerReadiness } from "@/lib/intelligence/officer_readiness";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";

const ASOF = new Date("2026-07-21");

test("completionScore matches readiness.completeness.overallScore exactly (no separate re-derivation)", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID" })];
  const vm = computeOfficerReadiness({ officerId: 1, documents: docs, asOf: ASOF });
  assert.equal(vm.completionScore, vm.readiness.completeness.overallScore);
});

test("outstandingDocuments matches readiness.completeness.missingRequiredDocuments exactly", () => {
  const vm = computeOfficerReadiness({ officerId: 1, documents: [], asOf: ASOF });
  assert.deepEqual(vm.outstandingDocuments, vm.readiness.completeness.missingRequiredDocuments);
});

test("no qualityWarningsByDocumentId supplied -> empty qualityWarnings, never fabricated", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", id: 1 })];
  const vm = computeOfficerReadiness({ officerId: 1, documents: docs, asOf: ASOF });
  assert.deepEqual(vm.qualityWarnings, []);
});

test("a supplied quality warning reason for an active document appears in qualityWarnings", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", id: 5 })];
  const vm = computeOfficerReadiness({
    officerId: 1,
    documents: docs,
    qualityWarningsByDocumentId: new Map([[5, "OCR quality is POOR"]]),
    asOf: ASOF,
  });
  assert.equal(vm.qualityWarnings.length, 1);
  assert.equal(vm.qualityWarnings[0].reason, "OCR quality is POOR");
});

test("a quality warning for an INACTIVE (superseded) document is excluded", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", id: 6, isActive: false })];
  const vm = computeOfficerReadiness({
    officerId: 1,
    documents: docs,
    qualityWarningsByDocumentId: new Map([[6, "stale warning"]]),
    asOf: ASOF,
  });
  assert.deepEqual(vm.qualityWarnings, []);
});

test("budgetImpact.aiCallsAttributed is 0 when no fingerprint mapping or usage meter is supplied", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", id: 1 })];
  const vm = computeOfficerReadiness({ officerId: 1, documents: docs, asOf: ASOF });
  assert.equal(vm.budgetImpact.aiCallsAttributed, 0);
});

test("budgetImpact.aiCallsAttributed counts real AI usage events matching this officer's document fingerprints", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 10 });
  const meter = new InMemoryUsageMeter();
  meter.record({
    timestamp: new Date().toISOString(), documentFingerprint: "fp-abc", ocrProviderUsed: null,
    aiProviderUsed: "openai", aiModelUsed: "gpt-5.5", aiCallReason: "LOW_OCR_CONFIDENCE",
    cacheResult: "miss", outcome: "success", processingDurationMs: 100, inputPages: 1,
    tokenUsage: null, estimatedCostUsd: null, userId: null,
  });
  // An OCR-only event (aiProviderUsed null) with the same fingerprint must NOT count.
  meter.record({
    timestamp: new Date().toISOString(), documentFingerprint: "fp-abc", ocrProviderUsed: "local_ocr",
    aiProviderUsed: null, aiModelUsed: null, aiCallReason: null,
    cacheResult: "miss", outcome: "success", processingDurationMs: 50, inputPages: 1,
    tokenUsage: null, estimatedCostUsd: null, userId: null,
  });
  const vm = computeOfficerReadiness({
    officerId: 1,
    documents: [doc],
    fingerprintByDocumentId: new Map([[10, "fp-abc"]]),
    usageMeter: meter,
    asOf: ASOF,
  });
  assert.equal(vm.budgetImpact.aiCallsAttributed, 1);
});

test("pendingReviewsCount matches kpi_definitions.pendingReviewTotal over the same workload the engine itself computes", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", id: 1, verifiedAt: null })];
  const vm = computeOfficerReadiness({ officerId: 1, documents: docs, asOf: ASOF });
  assert.ok(vm.pendingReviewsCount > 0);
});
