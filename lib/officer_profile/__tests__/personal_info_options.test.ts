import { test } from "node:test";
import assert from "node:assert/strict";

import { BLOOD_GROUP_OPTIONS } from "@/lib/officer_profile/blood_group_options";
import { RH_OPTIONS } from "@/lib/officer_profile/rh_options";
import { MARITAL_STATUS_OPTIONS } from "@/lib/officer_profile/marital_status_options";
import { SHIRT_SIZE_OPTIONS } from "@/lib/officer_profile/shirt_size_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { NATIONALITY_OPTIONS, DEFAULT_NATIONALITY } from "@/lib/officer_profile/nationality_options";

test("blood group options match Part G exactly (A, B, AB, O, Unknown)", () => {
  assert.deepEqual([...BLOOD_GROUP_OPTIONS], ["A", "B", "AB", "O", "ไม่ระบุ"]);
});

test("Rh options match Part G exactly (Rh+, Rh-, Unknown)", () => {
  assert.deepEqual([...RH_OPTIONS], ["Rh+", "Rh-", "ไม่ระบุ"]);
});

test("marital status options match Part G exactly", () => {
  assert.deepEqual([...MARITAL_STATUS_OPTIONS], ["โสด", "สมรส", "หย่า", "หม้าย", "ไม่ระบุ"]);
});

test("shirt size options match Part G exactly (XS through 5XL)", () => {
  assert.deepEqual([...SHIRT_SIZE_OPTIONS], ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
});

test("Thai province list has exactly 77 unique entries, including Bangkok", () => {
  assert.equal(THAI_PROVINCE_OPTIONS.length, 77);
  assert.equal(new Set(THAI_PROVINCE_OPTIONS).size, 77);
  assert.ok(THAI_PROVINCE_OPTIONS.includes("กรุงเทพมหานคร"));
});

test("nationality defaults to ไทย and offers suggestions", () => {
  assert.equal(DEFAULT_NATIONALITY, "ไทย");
  assert.ok(NATIONALITY_OPTIONS.includes(DEFAULT_NATIONALITY));
  assert.equal(NATIONALITY_OPTIONS[0], DEFAULT_NATIONALITY);
});
