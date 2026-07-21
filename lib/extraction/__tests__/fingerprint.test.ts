import { test } from "node:test";
import assert from "node:assert/strict";

import { fingerprintBytes, buildCacheKey } from "@/lib/extraction/fingerprint";

test("fingerprintBytes: identical bytes produce identical fingerprints", () => {
  const bytes = new TextEncoder().encode("hello world");
  assert.equal(fingerprintBytes(bytes), fingerprintBytes(new TextEncoder().encode("hello world")));
});

test("fingerprintBytes: different bytes produce different fingerprints", () => {
  const a = fingerprintBytes(new TextEncoder().encode("file A"));
  const b = fingerprintBytes(new TextEncoder().encode("file B"));
  assert.notEqual(a, b);
});

test("fingerprintBytes: produces a 64-character hex SHA-256 digest", () => {
  const hash = fingerprintBytes(new TextEncoder().encode("x"));
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("buildCacheKey: identical inputs produce identical keys", () => {
  const input = { fileFingerprint: "abc123", ocrProvider: "tesseract", extractionRulesVersion: "1.0.0" };
  assert.equal(buildCacheKey(input), buildCacheKey({ ...input }));
});

test("buildCacheKey: a different fingerprint changes the key", () => {
  const base = { fileFingerprint: "abc123", ocrProvider: "tesseract", extractionRulesVersion: "1.0.0" };
  assert.notEqual(buildCacheKey(base), buildCacheKey({ ...base, fileFingerprint: "xyz789" }));
});

test("buildCacheKey: a rules-version bump changes the key (so stale cache entries are naturally invalidated)", () => {
  const base = { fileFingerprint: "abc123", ocrProvider: "tesseract", extractionRulesVersion: "1.0.0" };
  assert.notEqual(buildCacheKey(base), buildCacheKey({ ...base, extractionRulesVersion: "1.0.1" }));
});

test("buildCacheKey: an AI model/prompt-schema change changes the key", () => {
  const base = { fileFingerprint: "abc123", ocrProvider: "tesseract", extractionRulesVersion: "1.0.0" };
  const withAi = buildCacheKey({ ...base, aiProviderModel: "openai/gpt-5.5", aiPromptSchemaVersion: "1.0.0" });
  assert.notEqual(buildCacheKey(base), withAi);
});
