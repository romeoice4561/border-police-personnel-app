import { test } from "node:test";
import assert from "node:assert/strict";

import { handleExtractDocument, handleAiFallback } from "@/lib/extraction/extraction_api_handlers";
import { createExtractionContainer } from "@/lib/extraction/extraction_container";
import { InMemoryExtractionCache } from "@/lib/extraction/extraction_cache";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";
import type { OCREngine, OCRResult } from "@/lib/ocr/ocr_types";
import type { AiExtractionProvider, AiExtractionResponse } from "@/lib/extraction/providers/extraction_provider_types";
import type { DocumentUploadService } from "@/lib/document/document_upload_service";

/**
 * End-to-end route-level verification of the Tier 3 AI-fallback path using
 * a MOCK AiExtractionProvider — never the real OpenAI key. Per the user's
 * explicit instruction: exercise the complete route + confirmation-gate +
 * budget-policy + cache plumbing without spending real API budget or
 * touching lib/extraction/providers/openai_document_provider.ts's real
 * implementation. Drives the exact same handleExtractDocument /
 * handleAiFallback functions the real API routes call — this is the
 * framework-agnostic core, one layer below the Next.js route file itself
 * (which is a two-line adapter with nothing left to verify beyond this).
 */

const LOW_CONFIDENCE_TEXT = "completely garbled unreadable text !!! @@@ ###";

function fakeOcrResult(text: string, confidence: number): OCRResult {
  return { fullText: text, confidence, words: [], lines: [], blocks: [], processingTimeMs: 5, language: "mixed" };
}

function fakeOcrEngine(result: OCRResult): OCREngine {
  return { async recognize() { return result; } };
}

function mockAiProvider(response: AiExtractionResponse, opts?: { fail?: boolean }): { provider: AiExtractionProvider; getCallCount: () => number } {
  let calls = 0;
  return {
    provider: {
      providerName: "mock-ai-provider",
      modelName: "mock-model",
      promptSchemaVersion: "test-1.0.0",
      async extractDocumentFields() {
        calls += 1;
        if (opts?.fail) throw new Error("simulated provider failure");
        return response;
      },
    },
    getCallCount: () => calls,
  };
}

const FAKE_FILE_BYTES = new TextEncoder().encode("fake-document-bytes-for-ai-fallback-test");

function fakeDocumentService(mimeType = "image/png"): DocumentUploadService {
  return {
    async getDownloadInfo() {
      return { fileUrl: "https://fake-storage.test/doc.png", filename: "doc.png", mimeType };
    },
  } as unknown as DocumentUploadService;
}

/** Stubs global fetch (used internally by fetchDocumentBytes) to return FAKE_FILE_BYTES without any real network call. */
function withFakeFetch<T>(fn: () => Promise<T>): Promise<T> {
  const original = global.fetch;
  global.fetch = (async () =>
    new Response(FAKE_FILE_BYTES, { status: 200 })) as unknown as typeof fetch;
  return fn().finally(() => {
    global.fetch = original;
  });
}

test("full route flow: low-confidence OCR -> gate recommends AI -> confirmed mock AI call -> exactly one call -> structured result returned", async () => {
  await withFakeFetch(async () => {
    const cache = new InMemoryExtractionCache();
    const usageMeter = new InMemoryUsageMeter();
    const { provider, getCallCount } = mockAiProvider({
      fields: { title: "Mock Extracted Title", expiryDate: "2030-01-01" },
      confidence: 0.95,
      tokenUsage: null,
    });
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache,
      usageMeter,
      aiProvider: provider,
      aiProviderConfigured: true,
    });
    const service = fakeDocumentService();

    // Step 1: run Tier-1-only extraction — must NOT call the AI provider at all.
    const extractRes = await handleExtractDocument(service, container, "1", "42");
    assert.equal(extractRes.status, 200);
    const extractBody = await extractRes.json();
    assert.equal(extractBody.data.aiWasUsed, false);
    assert.ok(extractBody.data.aiFallbackReason, "a low-confidence result must carry an aiFallbackReason");
    assert.equal(getCallCount(), 0, "the mock AI provider must not be called by /extract");

    // Step 2: calling ai-fallback WITHOUT confirmation must be rejected, zero calls.
    const unconfirmedReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: false }) });
    const unconfirmedRes = await handleAiFallback(service, container, "1", "42", unconfirmedReq, "user-1");
    assert.equal(unconfirmedRes.status, 403);
    assert.equal(getCallCount(), 0, "no AI call may occur before explicit confirmation");

    // Step 3: confirmed call -> exactly one mock AI call, structured result returned.
    const confirmedReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const confirmedRes = await handleAiFallback(service, container, "1", "42", confirmedReq, "user-1");
    assert.equal(confirmedRes.status, 200);
    const confirmedBody = await confirmedRes.json();
    assert.equal(confirmedBody.data.aiWasUsed, true);
    assert.ok(confirmedBody.data.fields.some((f: { code: string; normalizedValue: string | null }) => f.code === "title" && f.normalizedValue === "Mock Extracted Title"));
    assert.equal(getCallCount(), 1, "exactly one AI call must have occurred");

    // Step 4: a second confirmed call for the SAME document must be blocked by
    // the max-one-AI-call-per-document budget rule — call count stays at 1.
    const secondConfirmedReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const secondRes = await handleAiFallback(service, container, "1", "42", secondConfirmedReq, "user-1");
    assert.equal(secondRes.status, 403);
    assert.equal(getCallCount(), 1, "maxAiCallsPerDocument=1 must block a second automatic/confirmed call for the same document");
  });
});

test("AI provider failure preserves the original OCR result and reports aiFallbackFailed, with no automatic retry", async () => {
  await withFakeFetch(async () => {
    const cache = new InMemoryExtractionCache();
    const usageMeter = new InMemoryUsageMeter();
    const { provider, getCallCount } = mockAiProvider({ fields: {}, confidence: null, tokenUsage: null }, { fail: true });
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache,
      usageMeter,
      aiProvider: provider,
      aiProviderConfigured: true,
    });
    const service = fakeDocumentService();

    const extractRes = await handleExtractDocument(service, container, "1", "99");
    assert.equal(extractRes.status, 200);
    const extractBody = await extractRes.json();

    const confirmedReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const failRes = await handleAiFallback(service, container, "1", "99", confirmedReq, "user-1");
    assert.equal(failRes.status, 200, "AI failure must not be a hard error — the OCR result stays usable");
    const failBody = await failRes.json();
    assert.equal(failBody.data.aiFallbackFailed, true);
    assert.equal(failBody.data.aiWasUsed, extractBody.data.aiWasUsed, "the preserved result must be the original OCR-only result");
    assert.equal(getCallCount(), 1, "exactly one attempted call — no automatic retry on failure");

    // Retrying again requires a fresh explicit confirmation (still user-driven,
    // never automatic) — and since the failed attempt did not count against
    // the per-document budget as a *successful* call, this call is allowed to
    // proceed to the provider again (still mocked, still failing).
    const retryReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    await handleAiFallback(service, container, "1", "99", retryReq, "user-1");
    assert.ok(getCallCount() <= 2, "no hidden automatic retry loop occurred — call count grew by at most one explicit retry");
  });
});

test("ai-fallback on an unconfigured provider returns AI_NOT_CONFIGURED (503) and never invokes any provider code", async () => {
  await withFakeFetch(async () => {
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache: new InMemoryExtractionCache(),
      usageMeter: new InMemoryUsageMeter(),
      aiProviderConfigured: false,
    });
    const service = fakeDocumentService();

    await handleExtractDocument(service, container, "1", "7");
    const req = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const res = await handleAiFallback(service, container, "1", "7", req, "user-1");
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error.code, "AI_NOT_CONFIGURED");
  });
});

test("duplicate document (repeated /extract, cache reused, zero extra OCR) still allows exactly one AI call and blocks a second", async () => {
  await withFakeFetch(async () => {
    const cache = new InMemoryExtractionCache();
    const usageMeter = new InMemoryUsageMeter();
    const { provider, getCallCount } = mockAiProvider({ fields: { title: "x" }, confidence: 0.9, tokenUsage: null });
    const container = createExtractionContainer({
      ocrEngine: fakeOcrEngine(fakeOcrResult(LOW_CONFIDENCE_TEXT, 30)),
      cache,
      usageMeter,
      aiProvider: provider,
      aiProviderConfigured: true,
    });
    const service = fakeDocumentService();

    await handleExtractDocument(service, container, "1", "55");
    // Second /extract call with identical bytes -> cache hit (fromCache: true), no repeat OCR.
    const secondExtract = await handleExtractDocument(service, container, "1", "55");
    const secondExtractBody = await secondExtract.json();
    assert.equal(secondExtractBody.data.fromCache, true);

    // The duplicate-reprocessing guard (spec §6/§8) protects against AI
    // being called MULTIPLE times for the same file fingerprint — it is
    // enforced via the per-document call-history budget check
    // (maxAiCallsPerDocument, default 1), not by refusing AI outright just
    // because the OCR/deterministic result came from cache. A cache hit on
    // /extract is the expected, desired behavior (spec §1's whole point);
    // it must not by itself block a still-unused AI fallback.
    const firstReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const firstRes = await handleAiFallback(service, container, "1", "55", firstReq, "user-1");
    assert.equal(firstRes.status, 200, "a duplicate/cached OCR result must not itself block a first, still-unused AI call");
    assert.equal(getCallCount(), 1);

    const secondReq = new Request("http://test/ai-fallback", { method: "POST", body: JSON.stringify({ userConfirmed: true }) });
    const secondRes = await handleAiFallback(service, container, "1", "55", secondReq, "user-1");
    assert.equal(secondRes.status, 403, "a second AI call for the same document fingerprint must be blocked by the per-document budget");
    assert.equal(getCallCount(), 1, "no AI call may occur beyond the per-document maximum, regardless of cache state");
  });
});
