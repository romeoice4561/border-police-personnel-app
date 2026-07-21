import { test } from "node:test";
import assert from "node:assert/strict";

import { handleExtractDocument, handleAiFallback } from "@/lib/extraction/extraction_api_handlers";
import { createExtractionContainer } from "@/lib/extraction/extraction_container";
import { InMemoryExtractionCache } from "@/lib/extraction/extraction_cache";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";
import { InMemoryObservabilityEmitter } from "@/lib/extraction/observability";
import { computeCostDashboardMetrics } from "@/lib/extraction/cost_dashboard";
import type { OCREngine, OCRResult } from "@/lib/ocr/ocr_types";
import type { AiExtractionProvider, AiExtractionResponse } from "@/lib/extraction/providers/extraction_provider_types";
import type { DocumentUploadService } from "@/lib/document/document_upload_service";

/**
 * Route-level verification of the new Phase 48B governance modes AND of the
 * cost dashboard actually reflecting real events emitted by the real
 * handlers (not events fabricated directly in a dashboard test) — the
 * observability wiring added in extraction_api_handlers.ts / extraction_container.ts.
 */

const LOW_CONFIDENCE_TEXT = "completely garbled unreadable text !!! @@@ ###";
const FAKE_FILE_BYTES = new TextEncoder().encode("fake-document-bytes-for-governance-test");

function fakeOcrResult(text: string, confidence: number): OCRResult {
  return { fullText: text, confidence, words: [], lines: [], blocks: [], processingTimeMs: 5, language: "mixed" };
}
function fakeOcrEngine(result: OCRResult): OCREngine {
  return { async recognize() { return result; } };
}
function mockAiProvider(response: AiExtractionResponse): { provider: AiExtractionProvider; getCallCount: () => number } {
  let calls = 0;
  return {
    provider: {
      providerName: "mock-ai-provider",
      modelName: "mock-model",
      promptSchemaVersion: "test-1.0.0",
      async extractDocumentFields() {
        calls += 1;
        return response;
      },
    },
    getCallCount: () => calls,
  };
}
function fakeDocumentService(mimeType = "image/png"): DocumentUploadService {
  return {
    async getDownloadInfo() {
      return { fileUrl: "https://fake-storage.test/doc.png", filename: "doc.png", mimeType };
    },
  } as unknown as DocumentUploadService;
}
function withFakeFetch<T>(fn: () => Promise<T>): Promise<T> {
  const original = global.fetch;
  global.fetch = (async () => new Response(FAKE_FILE_BYTES, { status: 200 })) as unknown as typeof fetch;
  return fn().finally(() => { global.fetch = original; });
}

test("governance DISABLED blocks a confirmed AI-fallback call at the route layer, even with correct budget/confirmation", async () => {
  await withFakeFetch(async () => {
    const { provider, getCallCount } = mockAiProvider({ fields: { title: "x" }, confidence: 0.9, tokenUsage: null });
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache: new InMemoryExtractionCache(),
      usageMeter: new InMemoryUsageMeter(),
      aiProvider: provider,
      aiProviderConfigured: true,
      governancePolicy: { mode: "DISABLED" },
    });
    const service = fakeDocumentService();

    await handleExtractDocument(service, container, "1", "1");
    const req = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const res = await handleAiFallback(service, container, "1", "1", req, "user-1");
    assert.equal(res.status, 403);
    assert.equal(getCallCount(), 0, "DISABLED governance must block the call before the provider is ever touched");
  });
});

test("governance DRY_RUN never invokes the real provider, returns dryRun:true, but still allows a subsequent real call if mode is switched back", async () => {
  await withFakeFetch(async () => {
    const { provider, getCallCount } = mockAiProvider({ fields: { title: "x" }, confidence: 0.9, tokenUsage: null });
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache: new InMemoryExtractionCache(),
      usageMeter: new InMemoryUsageMeter(),
      aiProvider: provider,
      aiProviderConfigured: true,
      governancePolicy: { mode: "DRY_RUN" },
    });
    const service = fakeDocumentService();

    await handleExtractDocument(service, container, "1", "2");
    const req = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const res = await handleAiFallback(service, container, "1", "2", req, "user-1");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.dryRun, true);
    assert.equal(body.data.aiWasUsed, false);
    assert.equal(getCallCount(), 0, "DRY_RUN must never invoke the real provider");
  });
});

test("cost dashboard metrics reflect real events emitted by the real handlers — cache hit, AI confirmed, AI blocked all show up from one realistic session", async () => {
  await withFakeFetch(async () => {
    const observability = new InMemoryObservabilityEmitter();
    const { provider } = mockAiProvider({ fields: { title: "x" }, confidence: 0.9, tokenUsage: null });
    const usageMeter = new InMemoryUsageMeter();
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache: new InMemoryExtractionCache(),
      usageMeter,
      aiProvider: provider,
      aiProviderConfigured: true,
      observability,
    });
    const service = fakeDocumentService();

    // First extract: cache miss, AI recommended.
    await handleExtractDocument(service, container, "1", "3");
    // Second extract on the same document: cache hit (duplicate).
    await handleExtractDocument(service, container, "1", "3");
    // Confirmed AI call: succeeds once.
    const confirmReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    await handleAiFallback(service, container, "1", "3", confirmReq, "user-1");
    // Second AI attempt on the same doc: blocked by budget.
    const secondReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    await handleAiFallback(service, container, "1", "3", secondReq, "user-1");

    const metrics = computeCostDashboardMetrics(observability, usageMeter, container.queue);
    assert.equal(metrics.ocrCacheMisses, 1);
    assert.equal(metrics.ocrCacheHits, 1);
    assert.equal(metrics.duplicateDocuments, 1);
    assert.equal(metrics.aiConfirmed, 1);
    assert.equal(metrics.aiCallsBlocked, 1);
    assert.equal(metrics.currentQueueSize, 0, "both /extract calls fully complete synchronously — nothing should remain active in the queue");
  });
});
