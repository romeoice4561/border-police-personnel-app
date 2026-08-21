/**
 * Unit tests for normalizePhoneMatchingKey (Phase DI-1 — Section 6).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/phone_matching_key.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";

test("081-234-5678, 0812345678, and +66812345678 all resolve to the SAME matching key", () => {
  const a = normalizePhoneMatchingKey("081-234-5678");
  const b = normalizePhoneMatchingKey("0812345678");
  const c = normalizePhoneMatchingKey("+66812345678");
  assert.equal(a, "66812345678");
  assert.equal(b, "66812345678");
  assert.equal(c, "66812345678");
});

test("handles spaced input", () => {
  assert.equal(normalizePhoneMatchingKey("081 234 5678"), "66812345678");
});

test("a value that already starts with 66 and has the right length is used as-is", () => {
  assert.equal(normalizePhoneMatchingKey("66812345678"), "66812345678");
});

test("an unrecognized shape returns digits-only without guessing a country code", () => {
  assert.equal(normalizePhoneMatchingKey("12345"), "12345");
  assert.equal(normalizePhoneMatchingKey("021234567"), "021234567");
});
