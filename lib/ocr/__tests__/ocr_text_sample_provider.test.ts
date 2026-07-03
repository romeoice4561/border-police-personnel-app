/**
 * Integration tests for the OCR -> classifier seam (Phase 10A).
 *
 * Uses a fake OCREngine (no Tesseract) whose text is fed through
 * OcrTextSampleProvider into the real ImageClassifier, proving that real OCR
 * text now drives classification — Thai keyword text lands PERSONNEL_PROFILE
 * / INDEX_PAGE etc., and empty OCR falls back to UNKNOWN exactly as the old
 * NullTextSampleProvider did. Also covers language selection and cache hash
 * pass-through.
 *
 * Run with:
 *   npx tsx --test lib/ocr/__tests__/ocr_text_sample_provider.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { OcrTextSampleProvider } from "@/lib/ocr/ocr_text_sample_provider";
import { ImageClassifier } from "@/lib/classifier/image_classifier";
import type { OCREngine, OCROptions, OCRResult } from "@/lib/ocr/ocr_types";
import { emptyOCRResult } from "@/lib/ocr/ocr_result";

/** Fake engine returning a fixed text; records the options it was called with. */
class FakeTextEngine implements OCREngine {
  lastOptions?: OCROptions;
  constructor(private readonly text: string) {}
  async recognize(_imagePath: string, options?: OCROptions): Promise<OCRResult> {
    this.lastOptions = options;
    return { ...emptyOCRResult(options?.language ?? "mixed", 5), fullText: this.text, confidence: 90 };
  }
}

test("returns the OCR full text as the classifier's text sample", async () => {
  const provider = new OcrTextSampleProvider({ engine: new FakeTextEngine("hello world") });
  const sample = await provider.sample({ source: "img.png" });
  assert.equal(sample, "hello world");
});

test("returns undefined when OCR found no text (so keyword rules simply don't fire)", async () => {
  const provider = new OcrTextSampleProvider({ engine: new FakeTextEngine("") });
  const sample = await provider.sample({ source: "img.png" });
  assert.equal(sample, undefined);
});

test("passes the image hash through to the engine for cache reuse", async () => {
  const engine = new FakeTextEngine("text");
  const provider = new OcrTextSampleProvider({ engine });
  await provider.sample({ source: "img.png", hash: "abc123" });
  assert.equal(engine.lastOptions?.hash, "abc123");
});

test("uses the configured language (defaults to mixed)", async () => {
  const engine = new FakeTextEngine("text");
  const provider = new OcrTextSampleProvider({ engine });
  await provider.sample({ source: "img.png" });
  assert.equal(engine.lastOptions?.language, "mixed");

  const thaiEngine = new FakeTextEngine("text");
  const thaiProvider = new OcrTextSampleProvider({ engine: thaiEngine, language: "tha" });
  await thaiProvider.sample({ source: "img.png" });
  assert.equal(thaiEngine.lastOptions?.language, "tha");
});

test("Thai OCR text 'Timeline รับราชการ' classifies the image as PERSONNEL_PROFILE (would reach OpenAI)", async () => {
  const classifier = new ImageClassifier({
    textSampleProvider: new OcrTextSampleProvider({ engine: new FakeTextEngine("... Timeline รับราชการ ...") }),
  });

  const result = await classifier.classify({ source: "profile.png" });

  assert.equal(result.category, "PERSONNEL_PROFILE");
  assert.equal(result.shouldProcess, true);
});

test("Thai OCR text 'สารบัญ' classifies the image as INDEX_PAGE (would be skipped, no OpenAI)", async () => {
  const classifier = new ImageClassifier({
    textSampleProvider: new OcrTextSampleProvider({ engine: new FakeTextEngine("สารบัญ หน้า 1") }),
  });

  const result = await classifier.classify({ source: "index.png" });

  assert.equal(result.category, "INDEX_PAGE");
  assert.equal(result.shouldProcess, false);
});

test("empty OCR text leaves the layout-only path in control (UNKNOWN for a blank stub image)", async () => {
  // With no OCR text and the default stub layout features, no rule reaches
  // the confidence floor — the image is UNKNOWN, exactly as before Phase 10A.
  const classifier = new ImageClassifier({
    textSampleProvider: new OcrTextSampleProvider({ engine: new FakeTextEngine("") }),
  });

  const result = await classifier.classify({ source: "blank.png" });

  assert.equal(result.category, "UNKNOWN");
  assert.equal(result.shouldProcess, false);
});
