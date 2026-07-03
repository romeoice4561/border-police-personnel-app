/**
 * Unit tests for DefaultOCRStatisticsBuilder (Phase 10A): average confidence,
 * average OCR time, cache hit rate, characters extracted.
 *
 * Run with:
 *   npx tsx --test lib/ocr/__tests__/ocr_statistics.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DefaultOCRStatisticsBuilder } from "@/lib/ocr/ocr_statistics";
import { emptyOCRResult } from "@/lib/ocr/ocr_result";
import type { OCRResult } from "@/lib/ocr/ocr_types";

function result(fullText: string, confidence: number, processingTimeMs: number): OCRResult {
  return { ...emptyOCRResult("mixed", processingTimeMs), fullText, confidence };
}

test("empty builder reports zeroes, not NaN", () => {
  const summary = new DefaultOCRStatisticsBuilder().build();

  assert.deepEqual(summary, {
    total_images: 0,
    fresh: 0,
    cache_hits: 0,
    cache_hit_rate: 0,
    average_confidence: 0,
    average_ocr_time_ms: 0,
    characters_extracted: 0,
  });
});

test("averages confidence across all recorded results", () => {
  const builder = new DefaultOCRStatisticsBuilder();
  builder.add(result("abc", 80, 100), "fresh");
  builder.add(result("de", 100, 200), "fresh");

  const summary = builder.build();
  assert.equal(summary.average_confidence, 90);
});

test("counts characters extracted across all results", () => {
  const builder = new DefaultOCRStatisticsBuilder();
  builder.add(result("hello", 90, 10), "fresh");
  builder.add(result("โลก", 90, 10), "fresh"); // 3 Thai chars

  const summary = builder.build();
  assert.equal(summary.characters_extracted, 8);
});

test("cache hit rate is cache hits over total images", () => {
  const builder = new DefaultOCRStatisticsBuilder();
  builder.add(result("a", 90, 100), "fresh");
  builder.add(result("a", 90, 0), "cache");
  builder.add(result("a", 90, 0), "cache");
  builder.add(result("a", 90, 100), "fresh");

  const summary = builder.build();
  assert.equal(summary.cache_hits, 2);
  assert.equal(summary.fresh, 2);
  assert.equal(summary.cache_hit_rate, 0.5);
});

test("average OCR time counts fresh runs only (cache hits excluded)", () => {
  const builder = new DefaultOCRStatisticsBuilder();
  builder.add(result("a", 90, 100), "fresh");
  builder.add(result("a", 90, 300), "fresh");
  builder.add(result("a", 90, 0), "cache"); // must not drag the average toward 0

  const summary = builder.build();
  assert.equal(summary.average_ocr_time_ms, 200); // (100 + 300) / 2
});

test("confidence is still averaged over cache hits even though their time is excluded", () => {
  const builder = new DefaultOCRStatisticsBuilder();
  builder.add(result("a", 60, 100), "fresh");
  builder.add(result("a", 60, 0), "cache");

  const summary = builder.build();
  assert.equal(summary.average_confidence, 60);
  assert.equal(summary.total_images, 2);
});
