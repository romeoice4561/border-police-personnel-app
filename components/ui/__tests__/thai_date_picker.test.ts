import test from "node:test";
import assert from "node:assert/strict";
import { THAI_PERSONNEL_YEAR_BE_MAX, THAI_PERSONNEL_YEAR_BE_MIN } from "@/components/ui/thai_date_picker";
import { formatThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";

test("Thai personnel year range covers historical birth years", () => {
  assert.equal(THAI_PERSONNEL_YEAR_BE_MIN, 2500);
  assert.equal(THAI_PERSONNEL_YEAR_BE_MAX, 2575);
});

test("Thai personnel date displays DD/MM/YYYY Buddhist Era", () => {
  assert.equal(formatThaiPersonnelDate("1985-08-11"), "11/08/2528");
});
