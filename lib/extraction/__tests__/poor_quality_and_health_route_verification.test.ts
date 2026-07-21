import { test } from "node:test";
import assert from "node:assert/strict";

import { handleExtractDocument } from "@/lib/extraction/extraction_api_handlers";
import { createExtractionContainer } from "@/lib/extraction/extraction_container";
import { InMemoryExtractionCache } from "@/lib/extraction/extraction_cache";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";
import { computeHealthSummary } from "@/lib/extraction/operational_health";
import { computeBudgetSnapshot } from "@/lib/extraction/budget_tracker";
import type { OCREngine, OCRResult, OCRWord } from "@/lib/ocr/ocr_types";
import type { DocumentUploadService } from "@/lib/document/document_upload_service";

function word(text: string, confidence: number): OCRWord {
  return { text, confidence, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } };
}
function fakeOcrEngine(result: OCRResult): OCREngine {
  return { async recognize() { return result; } };
}
function fakeDocumentService(mimeType = "image/png"): DocumentUploadService {
  return {
    async getDownloadInfo() {
      return { fileUrl: "https://fake-storage.test/doc.png", filename: "doc.png", mimeType };
    },
  } as unknown as DocumentUploadService;
}
function withFakeFetch<T>(bytes: Uint8Array, fn: () => Promise<T>): Promise<T> {
  const original = global.fetch;
  global.fetch = (async () => new Response(bytes.buffer as ArrayBuffer, { status: 200 })) as unknown as typeof fetch;
  return fn().finally(() => { global.fetch = original; });
}

test("scenario: poor-quality OCR (very low word confidence) through the real route -> ocrQuality.level POOR, recommendAiUsage false, retake message present", async () => {
  const words = Array.from({ length: 15 }, () => word("x", 8));
  const poorResult: OCRResult = {
    fullText: "บัตรประจำตัวประชาชน " + "x".repeat(40),
    confidence: 8,
    words,
    lines: [],
    blocks: [],
    processingTimeMs: 5,
    language: "mixed",
  };
  const container = createExtractionContainer({
    ocrEngine: fakeOcrEngine(poorResult),
    cache: new InMemoryExtractionCache(),
    usageMeter: new InMemoryUsageMeter(),
    aiProviderConfigured: false,
  });
  const service = fakeDocumentService();
  const bytes = new TextEncoder().encode("poor-quality-image-bytes");

  const res = await withFakeFetch(bytes, () => handleExtractDocument(service, container, "1", "42"));
  const body = await res.json();

  assert.equal(body.data.ocrQuality.level, "POOR");
  assert.equal(body.data.ocrQuality.recommendAiUsage, false, "poor quality must discourage AI, not recommend it");
  assert.equal(body.data.ocrQuality.recommendation, "Retake image before using AI.");
});

test("scenario: health summary reflects a real container's actual state (OCR configured, AI not configured, queue idle after synchronous completion)", async () => {
  const container = createExtractionContainer({
    ocrEngine: fakeOcrEngine({ fullText: "some text", confidence: 90, words: [word("x", 90)], lines: [], blocks: [], processingTimeMs: 5, language: "mixed" }),
    cache: new InMemoryExtractionCache(),
    usageMeter: new InMemoryUsageMeter(),
    aiProviderConfigured: false,
  });
  const service = fakeDocumentService();
  const bytes = new TextEncoder().encode("some-bytes");
  await withFakeFetch(bytes, () => handleExtractDocument(service, container, "1", "5"));

  const budgetSnapshot = computeBudgetSnapshot(container.usagePolicy, container.usageMeter, { userId: null });
  const health = computeHealthSummary({
    ocrEngineConfigured: true,
    aiProviderConfigured: container.aiProviderConfigured,
    cache: container.cache,
    usagePolicy: container.usagePolicy,
    budgetSnapshot,
    queue: container.queue,
    queueWarningThreshold: 10,
  });

  assert.equal(health.ocrAvailable, "HEALTHY");
  assert.equal(health.aiAvailable, "WARNING");
  assert.equal(health.queueHealthy, "HEALTHY", "the queue item completed synchronously within the request — nothing should remain active");
  assert.equal(health.overallStatus, "WARNING");
});
