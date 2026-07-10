import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeSearchText, stripAllWhitespace, fuzzyContains } from "@/lib/search/query_normalization";

test("normalizeSearchText collapses whitespace runs, trims, and lowercases", () => {
  assert.equal(normalizeSearchText("  Ror.Tor.Or.   Foo  "), "ror.tor.or. foo");
  assert.equal(normalizeSearchText("PHONE"), "phone");
});

test("stripAllWhitespace removes every space", () => {
  assert.equal(stripAllWhitespace("ร้อย ตชด.434"), "ร้อยตชด.434");
  assert.equal(stripAllWhitespace("a b c"), "abc");
});

test("fuzzyContains: typing '434' finds 'ร้อย ตชด.434' (spec's own example)", () => {
  assert.equal(fuzzyContains("ร้อย ตชด.434", "434"), true);
});

test("fuzzyContains: typing '081' finds a phone number", () => {
  assert.equal(fuzzyContains("081-234-5678", "081"), true);
});

test("fuzzyContains: typing 'ชูทอง' finds a surname", () => {
  assert.equal(fuzzyContains("ชูศักดิ์ ชูทอง", "ชูทอง"), true);
});

test("fuzzyContains: typing 'รอง ผกก.' finds a position, spacing-insensitively", () => {
  assert.equal(fuzzyContains("รอง ผกก.", "รอง ผกก."), true);
  assert.equal(fuzzyContains("รองผกก.", "รอง ผกก."), true, "extra/missing space in either side still matches");
});

test("fuzzyContains is case-insensitive for Latin text", () => {
  assert.equal(fuzzyContains("BPP HQ", "bpp"), true);
});

test("fuzzyContains returns false for a genuinely absent substring", () => {
  assert.equal(fuzzyContains("ร้อย ตชด.434", "999"), false);
});

test("fuzzyContains returns false for an empty/whitespace-only needle (never matches everything)", () => {
  assert.equal(fuzzyContains("anything", ""), false);
  assert.equal(fuzzyContains("anything", "   "), false);
});
