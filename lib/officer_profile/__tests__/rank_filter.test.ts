/**
 * Rank filter tests (Phase 26A stabilization — bug #2).
 *
 * The Rank filter dropdown must contain only genuine rank designations,
 * never units / names / phone numbers / OCR garbage mixed in.
 *
 * Run with:
 *   npx tsx --test lib/officer_profile/__tests__/rank_filter.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidRankValue, filterValidRanks } from "@/lib/officer_profile/rank_filter";

test("accepts genuine rank abbreviations", () => {
  for (const r of ["พ.ต.ท.", "ร.ต.อ.", "ร.ต.ท.", "พ.ต.ต.", "ร.ต.ต.", "พ.ต.อ.", "ด.ต.", "จ.ส.ต.", "ส.ต.อ.", "ส.ต.ท.", "ส.ต.ต."]) {
    assert.equal(isValidRankValue(r), true, `expected valid: ${r}`);
  }
});

test("accepts a 'ว่าที่' (acting) prefix on an otherwise genuine rank", () => {
  assert.equal(isValidRankValue("ว่าที่ พ.ต.ต."), true);
  assert.equal(isValidRankValue("ว่าที่ พ.ต.ท."), true);
});

test("accepts the full Thai rank word form", () => {
  assert.equal(isValidRankValue("ร้อยตำรวจเอก"), true);
  assert.equal(isValidRankValue("ร้อยตำรวจโท"), true);
});

test("rejects a rank with a unit reference appended", () => {
  for (const r of ["กองกำกับการโรงเรียนตำรวจภูธร 4", "ผกก.กก.ตชด.14"]) {
    assert.equal(isValidRankValue(r), false, `expected rejected (unit): ${r}`);
  }
});

test("rejects a rank with a person's name appended", () => {
  for (const r of ["พ.ต.ท.ชลัช", "พ.ต.อ.ธวิร์สักดิ์", "ร.ต.ท.ก.วิษณุ", "ว่าที่ พ.ต.กฤตวินรุจน์ ถุงชัย"]) {
    assert.equal(isValidRankValue(r), false, `expected rejected (name): ${r}`);
  }
});

test("rejects phone numbers and plain garbage", () => {
  for (const r of ["เบอร์โทร 08-1036259", "083-1314747", "หน.", "รอง", "ร้อย"]) {
    assert.equal(isValidRankValue(r), false, `expected rejected (garbage): ${r}`);
  }
});

test("rejects empty / whitespace-only", () => {
  assert.equal(isValidRankValue(""), false);
  assert.equal(isValidRankValue("   "), false);
});

test("filterValidRanks keeps only valid ranks, de-duplicates, preserves order", () => {
  const input = ["พ.ต.ท.", "พ.ต.ท.ชลัช", "ร.ต.อ.", "หน.", "พ.ต.ท.", "กองกำกับการโรงเรียนตำรวจภูธร 4"];
  const result = filterValidRanks(input);
  assert.deepEqual(result, ["พ.ต.ท.", "ร.ต.อ."]);
});

test("never mixes a unit-only string into the rank list even when it contains no obvious rank token", () => {
  assert.equal(isValidRankValue("ร้อย ตชด.117"), false);
  assert.equal(isValidRankValue("กก.ตชด.44"), false);
});
