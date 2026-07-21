import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeOcrQuality } from "@/lib/extraction/ocr_quality_analyzer";
import type { OCRResult, OCRWord } from "@/lib/ocr/ocr_types";

function word(text: string, confidence: number): OCRWord {
  return { text, confidence, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } };
}

function ocrResult(overrides: Partial<OCRResult> = {}): OCRResult {
  return {
    fullText: "some recognized text",
    confidence: 90,
    words: [],
    lines: [],
    blocks: [],
    processingTimeMs: 10,
    language: "mixed",
    ...overrides,
  };
}

test("empty OCR result (no text at all) classifies as UNKNOWN, not POOR", () => {
  const result = ocrResult({ fullText: "", words: [], lines: [] });
  const assessment = analyzeOcrQuality(result, { expectedFieldCodes: [], presentFieldCodes: [] });
  assert.equal(assessment.level, "UNKNOWN");
});

test("high-confidence words, all expected fields present -> EXCELLENT or GOOD, AI usage recommended", () => {
  const words = Array.from({ length: 20 }, () => word("x", 96));
  const result = ocrResult({ fullText: "x".repeat(50), words, lines: [{ text: "line", confidence: 96, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }] });
  const assessment = analyzeOcrQuality(result, { expectedFieldCodes: ["a", "b"], presentFieldCodes: ["a", "b"] });
  assert.ok(assessment.level === "EXCELLENT" || assessment.level === "GOOD");
  assert.equal(assessment.recommendAiUsage, true);
  assert.equal(assessment.recommendation, null);
});

test("very low confidence words -> POOR, recommends retaking the image, discourages AI", () => {
  const words = Array.from({ length: 20 }, () => word("x", 10));
  const result = ocrResult({ fullText: "x".repeat(50), words, lines: [] });
  const assessment = analyzeOcrQuality(result, { expectedFieldCodes: ["a", "b", "c"], presentFieldCodes: [] });
  assert.equal(assessment.level, "POOR");
  assert.equal(assessment.recommendAiUsage, false, "POOR quality must discourage AI usage, not recommend it");
  assert.equal(assessment.recommendation, "Retake image before using AI.");
});

test("missing expected fields drag quality down even with decent word confidence", () => {
  const words = Array.from({ length: 10 }, () => word("x", 75));
  const resultManyMissing = ocrResult({ fullText: "x".repeat(30), words });
  const assessmentManyMissing = analyzeOcrQuality(resultManyMissing, {
    expectedFieldCodes: ["a", "b", "c", "d"],
    presentFieldCodes: [],
  });
  const resultNoneMissing = ocrResult({ fullText: "x".repeat(30), words });
  const assessmentNoneMissing = analyzeOcrQuality(resultNoneMissing, {
    expectedFieldCodes: ["a", "b", "c", "d"],
    presentFieldCodes: ["a", "b", "c", "d"],
  });
  assert.ok(assessmentNoneMissing.metrics.missingFieldCount < assessmentManyMissing.metrics.missingFieldCount);
});

test("rotation and blur hints are always explicitly unavailable (null), never fabricated", () => {
  const result = ocrResult({ words: [word("x", 90)] });
  const assessment = analyzeOcrQuality(result, { expectedFieldCodes: [], presentFieldCodes: [] });
  assert.equal(assessment.metrics.rotationHint?.detected, false);
  assert.equal(assessment.metrics.rotationHint?.degrees, null);
  assert.equal(assessment.metrics.blurHint?.detected, false);
  assert.equal(assessment.metrics.blurHint?.score, null);
});

test("zero words -> averageWordConfidence and highConfidenceWordFraction are null, not zero (measured-vs-unmeasurable distinction)", () => {
  const result = ocrResult({ fullText: "text but no word geometry", words: [] });
  const assessment = analyzeOcrQuality(result, { expectedFieldCodes: [], presentFieldCodes: [] });
  assert.equal(assessment.metrics.averageWordConfidence, null);
  assert.equal(assessment.metrics.highConfidenceWordFraction, null);
});

test("empty lines are counted separately from missing text entirely", () => {
  const result = ocrResult({
    fullText: "some text",
    words: [word("x", 90)],
    lines: [
      { text: "real line", confidence: 90, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
      { text: "  ", confidence: 0, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
    ],
  });
  const assessment = analyzeOcrQuality(result, { expectedFieldCodes: [], presentFieldCodes: [] });
  assert.equal(assessment.metrics.emptyLineCount, 1);
  assert.equal(assessment.metrics.lineCount, 2);
});
