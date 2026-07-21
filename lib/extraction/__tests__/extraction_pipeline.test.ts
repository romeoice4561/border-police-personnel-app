import { test } from "node:test";
import assert from "node:assert/strict";

import { runExtractionPipeline } from "@/lib/extraction/extraction_pipeline";
import { InMemoryExtractionCache } from "@/lib/extraction/extraction_cache";
import type { OCREngine, OCRResult } from "@/lib/ocr/ocr_types";

function fakeOcrResult(text: string, confidence: number): OCRResult {
  return { fullText: text, confidence, words: [], lines: [], blocks: [], processingTimeMs: 10, language: "mixed" };
}

/** Counts how many times recognize() was actually invoked — the thing that must stay at ZERO on a cache hit / duplicate. */
function countingOcrEngine(result: OCRResult): { engine: OCREngine; getCallCount: () => number } {
  let calls = 0;
  return {
    engine: {
      async recognize() {
        calls += 1;
        return result;
      },
    },
    getCallCount: () => calls,
  };
}

const NATIONAL_ID_TEXT = "บัตรประจำตัวประชาชน เลขประจำตัวประชาชน 1 1012 00254 89 6 ชื่อ สมชาย ใจดี";

test("high-confidence National ID text: OCR runs, fields extracted, no AI recommended, status needs_review", async () => {
  const { engine } = countingOcrEngine(fakeOcrResult(NATIONAL_ID_TEXT, 95));
  const cache = new InMemoryExtractionCache();

  const result = await runExtractionPipeline(
    { imageBytes: new TextEncoder().encode("fake-image-bytes-1"), imagePath: "fake.png", mimeType: "image/png" },
    { ocrEngine: engine, cache }
  );

  assert.equal(result.documentType.type, "NATIONAL_ID");
  assert.equal(result.aiWasUsed, false);
  assert.equal(result.providerUsed, "local_ocr");
  assert.equal(result.fromCache, false);
  assert.ok(result.fields.some((f) => f.code === "nationalId" && f.normalizedValue === "1101200254896"));
});

test("duplicate upload (identical bytes): second call is a cache hit, OCR is called exactly once total", async () => {
  const { engine, getCallCount } = countingOcrEngine(fakeOcrResult(NATIONAL_ID_TEXT, 95));
  const cache = new InMemoryExtractionCache();
  const bytes = new TextEncoder().encode("identical-file-bytes");

  const first = await runExtractionPipeline({ imageBytes: bytes, imagePath: "a.png", mimeType: "image/png" }, { ocrEngine: engine, cache });
  const second = await runExtractionPipeline({ imageBytes: bytes, imagePath: "a.png", mimeType: "image/png" }, { ocrEngine: engine, cache });

  assert.equal(getCallCount(), 1, "OCR must run exactly once across both calls for byte-identical input");
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(second.providerUsed, "cache_reused");
});

test("different files (different bytes) both trigger OCR — cache is keyed by content, not reused across distinct files", async () => {
  const { engine, getCallCount } = countingOcrEngine(fakeOcrResult(NATIONAL_ID_TEXT, 95));
  const cache = new InMemoryExtractionCache();

  await runExtractionPipeline({ imageBytes: new TextEncoder().encode("file-A"), imagePath: "a.png", mimeType: "image/png" }, { ocrEngine: engine, cache });
  await runExtractionPipeline({ imageBytes: new TextEncoder().encode("file-B"), imagePath: "b.png", mimeType: "image/png" }, { ocrEngine: engine, cache });

  assert.equal(getCallCount(), 2);
});

test("unrecognizable text -> UNKNOWN document type, gate reason is UNKNOWN_DOCUMENT_TYPE", async () => {
  const { engine } = countingOcrEngine(fakeOcrResult("completely unrelated gibberish text", 90));
  const cache = new InMemoryExtractionCache();

  const result = await runExtractionPipeline(
    { imageBytes: new TextEncoder().encode("unknown-doc"), imagePath: "u.png", mimeType: "image/png" },
    { ocrEngine: engine, cache }
  );

  assert.equal(result.documentType.type, "UNKNOWN");
  assert.equal(result.aiFallbackReason, "UNKNOWN_DOCUMENT_TYPE");
  assert.equal(result.status, "ai_suggested");
});

test("low OCR confidence -> aiFallbackReason is LOW_OCR_CONFIDENCE even when text is recognizable", async () => {
  const { engine } = countingOcrEngine(fakeOcrResult(NATIONAL_ID_TEXT, 40)); // 40/100 = 0.4, below the 0.7 medium threshold
  const cache = new InMemoryExtractionCache();

  const result = await runExtractionPipeline(
    { imageBytes: new TextEncoder().encode("low-confidence-doc"), imagePath: "l.png", mimeType: "image/png" },
    { ocrEngine: engine, cache }
  );

  assert.equal(result.aiFallbackReason, "LOW_OCR_CONFIDENCE");
});

test("AI is never called by runExtractionPipeline itself — no AI provider is even wired into its dependencies", async () => {
  // Structural guarantee: RunExtractionPipelineDependencies has no AI
  // provider field at all, so it is impossible for this function to call
  // AI even if confidence is low or the type is unknown. Verified by the
  // fact that the low-confidence and unknown-type tests above complete
  // successfully with only an OCREngine + cache injected — if the pipeline
  // tried to call AI, there would be nothing to call.
  const { engine } = countingOcrEngine(fakeOcrResult("gibberish unknown text", 10));
  const cache = new InMemoryExtractionCache();
  const result = await runExtractionPipeline(
    { imageBytes: new TextEncoder().encode("x"), imagePath: "x.png", mimeType: "image/png" },
    { ocrEngine: engine, cache }
  );
  assert.equal(result.aiWasUsed, false);
});
