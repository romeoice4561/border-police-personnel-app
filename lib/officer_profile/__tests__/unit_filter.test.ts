/**
 * Border Patrol unit filter tests (Phase 23B — bug #4).
 *
 * The Unit combobox suggestions must contain only genuine Border Patrol units,
 * never ranks / schools / phone numbers / provinces / OCR garbage.
 *
 * Run with:
 *   npx tsx --test lib/officer_profile/__tests__/unit_filter.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidBorderPatrolUnit, filterValidBorderPatrolUnits } from "@/lib/officer_profile/unit_filter";

test("accepts genuine Border Patrol units", () => {
  for (const u of ["ร้อย ตชด.114", "กก.ตชด.44", "ตชด.425", "กองร้อยตำรวจตระเวนชายแดนที่ 227", "ผบ.มว. ร้อย ตชด.114", "บช.ตชด."]) {
    assert.equal(isValidBorderPatrolUnit(u), true, `expected valid: ${u}`);
  }
});

test("rejects bare ranks and rank-prefixed strings", () => {
  for (const u of ["ร.ต.ต.", "พ.ต.อ.", "ร.ต.น.", "พ.ต.ท.อาคม การบรรจง ผบ.ร้อย ตชด.125", "ส.ต.ต.(ผบ.หมู่ ฝอ.จว.ชลบุรี)"]) {
    assert.equal(isValidBorderPatrolUnit(u), false, `expected rejected (rank): ${u}`);
  }
});

test("rejects schools / training institutions", () => {
  for (const u of ["รร.รด.", "รร.นรต.", "โรงเรียนตำรวจภูธร 5 ลำปาง", "สำเร็จการศึกษาจากโรงเรียนนายร้อยตำรวจ (รร.นรต.) รุ่นที่ 77", "ศฝร.ภ3"]) {
    assert.equal(isValidBorderPatrolUnit(u), false, `expected rejected (school): ${u}`);
  }
});

test("rejects phone numbers, provinces, and plain garbage", () => {
  for (const u of ["บอร์โทรศัพท์ 083 - 1314747", "เบอร์โทร 08-1036259", "จว.สุรินทร์", "อ.เมือง จว.มุกดาหาร", "ตำรวจ", "11", "32 อัตรา", "Border patrol police company 216"]) {
    assert.equal(isValidBorderPatrolUnit(u), false, `expected rejected (garbage): ${u}`);
  }
});

test("rejects empty / whitespace-only", () => {
  assert.equal(isValidBorderPatrolUnit(""), false);
  assert.equal(isValidBorderPatrolUnit("   "), false);
});

test("filterValidBorderPatrolUnits keeps only valid units, de-duplicates, preserves order", () => {
  const input = ["ร้อย ตชด.114", "ร.ต.ต.", "กก.ตชด.44", "รร.นรต.", "ร้อย ตชด.114", "จว.สุรินทร์", "ตชด.425"];
  const result = filterValidBorderPatrolUnits(input);
  assert.deepEqual(result, ["ร้อย ตชด.114", "กก.ตชด.44", "ตชด.425"]);
});

test("filter normalizes whitespace when de-duplicating", () => {
  const result = filterValidBorderPatrolUnits(["ร้อย  ตชด.114", "ร้อย ตชด.114"]);
  assert.deepEqual(result, ["ร้อย ตชด.114"]);
});
