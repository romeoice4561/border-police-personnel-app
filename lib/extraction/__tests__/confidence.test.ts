import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyConfidence, DEFAULT_CONFIDENCE_POLICY } from "@/lib/extraction/confidence";

test("null score classifies as 'unknown', never fabricated into 'low'", () => {
  assert.equal(classifyConfidence(null), "unknown");
});

test("NaN score classifies as 'unknown'", () => {
  assert.equal(classifyConfidence(NaN), "unknown");
});

test("boundary: exactly the high threshold (0.90) classifies as 'high'", () => {
  assert.equal(classifyConfidence(0.9), "high");
});

test("boundary: just below the high threshold (0.899) classifies as 'medium'", () => {
  assert.equal(classifyConfidence(0.899), "medium");
});

test("boundary: exactly the medium threshold (0.70) classifies as 'medium'", () => {
  assert.equal(classifyConfidence(0.7), "medium");
});

test("boundary: just below the medium threshold (0.699) classifies as 'low'", () => {
  assert.equal(classifyConfidence(0.699), "low");
});

test("0 classifies as 'low', not 'unknown' — a real measured zero is different from 'could not measure'", () => {
  assert.equal(classifyConfidence(0), "low");
});

test("1.0 classifies as 'high'", () => {
  assert.equal(classifyConfidence(1.0), "high");
});

test("a custom policy is honored instead of the default", () => {
  const strictPolicy = { highThreshold: 0.99, mediumThreshold: 0.95 };
  assert.equal(classifyConfidence(0.9, strictPolicy), "low");
  assert.equal(classifyConfidence(0.96, strictPolicy), "medium");
  assert.equal(classifyConfidence(0.99, strictPolicy), "high");
});

test("DEFAULT_CONFIDENCE_POLICY matches spec §4's suggested thresholds exactly", () => {
  assert.equal(DEFAULT_CONFIDENCE_POLICY.highThreshold, 0.9);
  assert.equal(DEFAULT_CONFIDENCE_POLICY.mediumThreshold, 0.7);
});
