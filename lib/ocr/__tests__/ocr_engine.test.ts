/**
 * Unit tests for the OCR caching engine (Phase 10A). Uses a fake base
 * OCREngine only — no Tesseract WASM, no real files. Verifies the
 * "never OCR the same image twice" caching rule and the cache/fresh source
 * reporting.
 *
 * Run with:
 *   npx tsx --test lib/ocr/__tests__/ocr_engine.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { CachingOCREngine } from "@/lib/ocr/ocr_engine";
import { InMemoryOCRCache } from "@/lib/ocr/ocr_cache";
import type { OCREngine, OCROptions, OCRResult, OCRSource } from "@/lib/ocr/ocr_types";
import { emptyOCRResult } from "@/lib/ocr/ocr_result";

/** A base engine that records every recognize() call and returns a canned result. */
class RecordingEngine implements OCREngine {
  calls = 0;
  lastOptions?: OCROptions;

  constructor(private readonly text: string, private readonly confidence = 90) {}

  async recognize(_imagePath: string, options?: OCROptions): Promise<OCRResult> {
    this.calls += 1;
    this.lastOptions = options;
    return { ...emptyOCRResult(options?.language ?? "mixed", 42), fullText: this.text, confidence: this.confidence };
  }
}

test("delegates to the base engine on a cache miss and stores the result", async () => {
  const base = new RecordingEngine("Timeline รับราชการ");
  const engine = new CachingOCREngine({ baseEngine: base, readBytes: () => new Uint8Array([1, 2, 3]) });

  const result = await engine.recognize("img.png");

  assert.equal(base.calls, 1);
  assert.equal(result.fullText, "Timeline รับราชการ");
});

test("reuses a cached result for the same image hash — never OCRs twice", async () => {
  const base = new RecordingEngine("cached text");
  const engine = new CachingOCREngine({ baseEngine: base, readBytes: () => new Uint8Array([9, 9, 9]) });

  await engine.recognize("img.png");
  await engine.recognize("img.png");
  await engine.recognize("img.png");

  assert.equal(base.calls, 1);
});

test("different image bytes produce different hashes and each is OCR'd once", async () => {
  const base = new RecordingEngine("text");
  let n = 0;
  const engine = new CachingOCREngine({
    baseEngine: base,
    readBytes: () => new Uint8Array([n++]), // distinct bytes each call
  });

  await engine.recognize("a.png");
  await engine.recognize("b.png");

  assert.equal(base.calls, 2);
});

test("an explicitly supplied hash is used for cache lookup instead of reading bytes", async () => {
  const base = new RecordingEngine("text");
  let readCalls = 0;
  const engine = new CachingOCREngine({
    baseEngine: base,
    readBytes: () => {
      readCalls += 1;
      return new Uint8Array([1]);
    },
  });

  await engine.recognize("a.png", { hash: "fixed-hash" });
  await engine.recognize("b.png", { hash: "fixed-hash" }); // same hash -> cache hit, no re-OCR

  assert.equal(base.calls, 1);
  assert.equal(readCalls, 0); // bytes never read when a hash is provided
});

test("onResolved reports 'fresh' on a miss and 'cache' on a subsequent hit", async () => {
  const base = new RecordingEngine("text");
  const sources: OCRSource[] = [];
  const engine = new CachingOCREngine({
    baseEngine: base,
    readBytes: () => new Uint8Array([7]),
    onResolved: (_result, source) => sources.push(source),
  });

  await engine.recognize("img.png");
  await engine.recognize("img.png");

  assert.deepEqual(sources, ["fresh", "cache"]);
});

test("the base engine receives the resolved hash so it could persist by hash too", async () => {
  const base = new RecordingEngine("text");
  const engine = new CachingOCREngine({ baseEngine: base, readBytes: () => new Uint8Array([1, 1]) });

  await engine.recognize("img.png");

  assert.ok(base.lastOptions?.hash, "base engine should receive a hash");
});

test("a shared cache lets a second engine instance reuse the first's results", async () => {
  const cache = new InMemoryOCRCache();
  const base1 = new RecordingEngine("text");
  const base2 = new RecordingEngine("text");

  const engine1 = new CachingOCREngine({ baseEngine: base1, cache, readBytes: () => new Uint8Array([5]) });
  const engine2 = new CachingOCREngine({ baseEngine: base2, cache, readBytes: () => new Uint8Array([5]) });

  await engine1.recognize("img.png");
  await engine2.recognize("img.png");

  assert.equal(base1.calls, 1);
  assert.equal(base2.calls, 0); // served from the shared cache
});
