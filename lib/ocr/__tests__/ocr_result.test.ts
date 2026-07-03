/**
 * Unit tests for OCRResult construction/derivation and the OCR cache
 * (Phase 10A). Pure — no Tesseract, no files.
 *
 * Run with:
 *   npx tsx --test lib/ocr/__tests__/ocr_result.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildOCRResult,
  characterCount,
  emptyOCRResult,
  isEmptyResult,
  type TesseractPageLike,
} from "@/lib/ocr/ocr_result";
import { hashImageBytes, InMemoryOCRCache } from "@/lib/ocr/ocr_cache";

test("buildOCRResult maps a flat page into the OCRResult shape", () => {
  const page: TesseractPageLike = {
    text: "  hello world  ",
    confidence: 91,
    words: [{ text: "hello", confidence: 92, bbox: { x0: 0, y0: 0, x1: 5, y1: 2 } }],
    lines: [{ text: "hello world", confidence: 90, bbox: { x0: 0, y0: 0, x1: 11, y1: 2 } }],
    blocks: [{ text: "hello world", confidence: 89, bbox: { x0: 0, y0: 0, x1: 11, y1: 2 } }],
  };

  const result = buildOCRResult(page, "eng", 123);

  assert.equal(result.fullText, "hello world"); // trimmed
  assert.equal(result.confidence, 91);
  assert.equal(result.words.length, 1);
  assert.equal(result.lines.length, 1);
  assert.equal(result.blocks.length, 1);
  assert.equal(result.language, "eng");
  assert.equal(result.processingTimeMs, 123);
});

test("buildOCRResult tolerates missing arrays and fields", () => {
  const result = buildOCRResult({ text: null, confidence: null }, "mixed", 0);

  assert.equal(result.fullText, "");
  assert.equal(result.confidence, 0);
  assert.deepEqual(result.words, []);
  assert.deepEqual(result.lines, []);
  assert.deepEqual(result.blocks, []);
});

test("missing bbox fields default to zero", () => {
  const result = buildOCRResult({ text: "x", words: [{ text: "x" }] }, "eng", 0);
  assert.deepEqual(result.words[0].bbox, { x0: 0, y0: 0, x1: 0, y1: 0 });
});

test("characterCount and isEmptyResult reflect the full text", () => {
  const filled = buildOCRResult({ text: "abcd" }, "eng", 0);
  assert.equal(characterCount(filled), 4);
  assert.equal(isEmptyResult(filled), false);

  const blank = emptyOCRResult("eng");
  assert.equal(characterCount(blank), 0);
  assert.equal(isEmptyResult(blank), true);
});

test("hashImageBytes is stable for identical bytes and differs for different bytes", () => {
  const a = hashImageBytes(new Uint8Array([1, 2, 3]));
  const b = hashImageBytes(new Uint8Array([1, 2, 3]));
  const c = hashImageBytes(new Uint8Array([1, 2, 4]));

  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("InMemoryOCRCache stores and retrieves by hash", () => {
  const cache = new InMemoryOCRCache();
  const result = buildOCRResult({ text: "cached" }, "mixed", 10);

  assert.equal(cache.get("h1").hit, false);
  cache.set("h1", result);

  const lookup = cache.get("h1");
  assert.equal(lookup.hit, true);
  assert.equal(lookup.entry?.result.fullText, "cached");
  assert.equal(cache.size(), 1);
});
