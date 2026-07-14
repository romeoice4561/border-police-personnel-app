import assert from "node:assert/strict";
import test from "node:test";
import { calculateRetirement } from "@/lib/personnel_calendar";
import { formatThaiPersonnelDate, parseThaiPersonnelDate, toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import { calculateCurrentAge } from "@/lib/officer_profile/retirement_calculator";
import { utcDate } from "@/lib/personnel_calendar";

test("Thai personnel date parses DD/MM/YYYY Buddhist Era without user subtracting 543", () => {
  const date = parseThaiPersonnelDate("11/08/2528");

  assert.equal(date?.toISOString().slice(0, 10), "1985-08-11");
  assert.equal(formatThaiPersonnelDate(date), "11/08/2528");
  assert.equal(toGregorianDateInputValue("11/08/2528"), "1985-08-11");
});

test("age and retirement are correct for 11 Aug 2528", () => {
  const dob = parseThaiPersonnelDate("11/08/2528");
  assert.ok(dob);

  assert.equal(calculateCurrentAge(dob, utcDate(2026, 7, 14)), 40);
  const retirement = calculateRetirement(dob, utcDate(2026, 7, 14));
  assert.equal(retirement?.retirementDate.toISOString().slice(0, 10), "2045-09-30");
  assert.equal(formatThaiPersonnelDate(retirement?.retirementDate), "30/09/2588");
});
