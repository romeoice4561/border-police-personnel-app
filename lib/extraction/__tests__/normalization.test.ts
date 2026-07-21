import { test } from "node:test";
import assert from "node:assert/strict";

import {
  thaiNumeralsToArabic,
  collapseWhitespace,
  normalizeLineBreaks,
  fixCommonPunctuation,
  normalizeHonorificSpacing,
  standardizeDocumentNumberSeparators,
  normalizeOcrText,
} from "@/lib/extraction/normalization";

test("thaiNumeralsToArabic converts every Thai digit glyph", () => {
  assert.equal(thaiNumeralsToArabic("๐๑๒๓๔๕๖๗๘๙"), "0123456789");
});

test("thaiNumeralsToArabic leaves non-digit characters untouched", () => {
  assert.equal(thaiNumeralsToArabic("ปี ๒๕๖๘ พ.ศ."), "ปี 2568 พ.ศ.");
});

test("thaiNumeralsToArabic on text with no Thai digits is a no-op", () => {
  assert.equal(thaiNumeralsToArabic("already arabic 12345"), "already arabic 12345");
});

test("collapseWhitespace collapses runs of spaces/newlines/tabs to one space and trims", () => {
  assert.equal(collapseWhitespace("  hello   \n\t world  "), "hello world");
});

test("normalizeLineBreaks converts CRLF and CR to LF", () => {
  assert.equal(normalizeLineBreaks("a\r\nb\rc\nd"), "a\nb\nc\nd");
});

test("fixCommonPunctuation collapses repeated separators", () => {
  assert.equal(fixCommonPunctuation("2568--01--01"), "2568-01-01");
  assert.equal(fixCommonPunctuation("path//to//file"), "path/to/file");
});

test("fixCommonPunctuation removes space before common punctuation", () => {
  assert.equal(fixCommonPunctuation("hello , world ."), "hello, world.");
});

test("normalizeHonorificSpacing ensures exactly one space after a recognized honorific", () => {
  assert.equal(normalizeHonorificSpacing("นายสมชาย"), "นาย สมชาย");
  assert.equal(normalizeHonorificSpacing("นาย   สมชาย"), "นาย สมชาย");
});

test("normalizeHonorificSpacing does not touch text with no recognized honorific", () => {
  assert.equal(normalizeHonorificSpacing("random text here"), "random text here");
});

test("standardizeDocumentNumberSeparators normalizes spaces/dots to a single dash", () => {
  assert.equal(standardizeDocumentNumberSeparators("12 345 678"), "12-345-678");
  assert.equal(standardizeDocumentNumberSeparators("12.345.678"), "12-345-678");
});

test("normalizeOcrText applies numeral conversion and reports it in appliedTransforms", () => {
  const result = normalizeOcrText("ปี ๒๕๖๘");
  assert.equal(result.normalizedText, "ปี 2568");
  assert.ok(result.appliedTransforms.includes("thai_numerals_to_arabic"));
});

test("normalizeOcrText reports no transforms applied for already-clean text", () => {
  const result = normalizeOcrText("clean text with nothing to fix");
  assert.deepEqual(result.appliedTransforms, []);
  assert.equal(result.normalizedText, "clean text with nothing to fix");
});

test("normalizeOcrText never throws on empty input", () => {
  const result = normalizeOcrText("");
  assert.equal(result.normalizedText, "");
});
