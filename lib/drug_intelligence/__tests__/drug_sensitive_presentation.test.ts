/**
 * Unit tests for Drug Intelligence sensitive-data presentation (Section 19).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_sensitive_presentation.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { maskIdentifierValue, maskPhoneNumber, presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";

test("maskIdentifierValue keeps only the last 4 characters visible", () => {
  assert.equal(maskIdentifierValue("1103700123456"), "xxxxxxxxx3456");
});

test("maskIdentifierValue fully masks short values instead of showing them in full", () => {
  assert.equal(maskIdentifierValue("12"), "xx");
  assert.equal(maskIdentifierValue(""), "x");
});

test("maskPhoneNumber groups a standard Thai 10-digit number as 081-xxx-5678", () => {
  assert.equal(maskPhoneNumber("0812345678"), "081-xxx-5678");
});

test("maskPhoneNumber handles the normalized 66-prefixed matching-key format", () => {
  assert.equal(maskPhoneNumber("66812345678"), "081-xxx-5678");
});

test("maskPhoneNumber falls back to last-4-visible for a non-standard (non-10-digit) shape", () => {
  assert.equal(maskPhoneNumber("081234567"), "xxxxx4567"); // 9 digits, not a standard Thai mobile length
});

test("maskPhoneNumber fully masks a value too short to partially mask safely", () => {
  assert.equal(maskPhoneNumber("12345"), "xxxxx");
});

test("presentIdentifierValue/presentPhoneNumber show FULL value only when canViewFull is true", () => {
  assert.equal(presentIdentifierValue("1103700123456", true), "1103700123456");
  assert.equal(presentIdentifierValue("1103700123456", false), "xxxxxxxxx3456");
  assert.equal(presentPhoneNumber("0812345678", true), "0812345678");
  assert.equal(presentPhoneNumber("0812345678", false), "081-xxx-5678");
});
