import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryExtractionCache } from "@/lib/extraction/extraction_cache";
import type { ExtractionPipelineResult } from "@/lib/extraction/extraction_pipeline_types";

function fakeResult(overrides: Partial<ExtractionPipelineResult> = {}): ExtractionPipelineResult {
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
    risk: { level: "SENSITIVE", reasons: [] },
    ocrQuality: null,
    ...overrides,
  };
}

test("cache miss on an unknown key", () => {
  const cache = new InMemoryExtractionCache();
  const lookup = cache.get("nonexistent");
  assert.equal(lookup.hit, false);
});

test("cache hit returns the exact stored result after set()", () => {
  const cache = new InMemoryExtractionCache();
  const result = fakeResult();
  cache.set("key-1", result);
  const lookup = cache.get("key-1");
  assert.equal(lookup.hit, true);
  assert.deepEqual(lookup.entry?.result, result);
});

test("size() reflects the number of distinct keys", () => {
  const cache = new InMemoryExtractionCache();
  assert.equal(cache.size(), 0);
  cache.set("a", fakeResult());
  cache.set("b", fakeResult());
  assert.equal(cache.size(), 2);
});

test("setting the same key twice overwrites rather than duplicating", () => {
  const cache = new InMemoryExtractionCache();
  cache.set("a", fakeResult({ overallConfidence: 0.5 }));
  cache.set("a", fakeResult({ overallConfidence: 0.95 }));
  assert.equal(cache.size(), 1);
  assert.equal(cache.get("a").entry?.result.overallConfidence, 0.95);
});

test("cachedAt is a valid ISO timestamp", () => {
  const cache = new InMemoryExtractionCache();
  cache.set("a", fakeResult());
  const entry = cache.get("a").entry;
  assert.ok(entry);
  assert.ok(!Number.isNaN(new Date(entry!.cachedAt).getTime()));
});
