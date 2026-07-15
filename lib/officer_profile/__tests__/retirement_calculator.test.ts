import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateRetirementYearBE, calculateBmi, calculateCurrentAge } from "@/lib/officer_profile/retirement_calculator";

test("calculateCurrentAge accepts ISO date strings serialized across the Server -> Client boundary", () => {
  const age = calculateCurrentAge("1985-08-11T00:00:00.000Z", new Date(Date.UTC(2026, 7, 14)));
  assert.equal(age, 41);
});

test("calculateRetirementYearBE returns retirement year (B.E.) = birth year + 60, converted to B.E.", () => {
  const dob = new Date(Date.UTC(1990, 0, 1));
  const today = new Date(Date.UTC(2026, 6, 7));
  const result = calculateRetirementYearBE(dob, today);
  assert.equal(result?.retirementYearBE, 2593); // 1990 + 60 = 2050 CE -> 2593 BE
});

test("calculateRetirementYearBE computes yearsRemaining relative to today, floored at 0", () => {
  const dob = new Date(Date.UTC(1990, 0, 1)); // retires 2050
  const today = new Date(Date.UTC(2026, 6, 7));
  const result = calculateRetirementYearBE(dob, today);
  assert.equal(result?.yearsRemaining, 24);
});

test("calculateRetirementYearBE floors yearsRemaining at 0 for an already-retired birth year", () => {
  const dob = new Date(Date.UTC(1950, 0, 1)); // retires 2010, long past
  const today = new Date(Date.UTC(2026, 6, 7));
  const result = calculateRetirementYearBE(dob, today);
  assert.equal(result?.yearsRemaining, 0);
});

test("calculateRetirementYearBE returns null when dateOfBirth is unset (never guesses)", () => {
  assert.equal(calculateRetirementYearBE(null), null);
});

test("calculateBmi computes weight(kg) / height(m)^2, rounded to 1 decimal", () => {
  assert.equal(calculateBmi(70, 175), 22.9);
});

test("calculateBmi returns null when weight or height is unset or height is non-positive (never guesses)", () => {
  assert.equal(calculateBmi(null, 175), null);
  assert.equal(calculateBmi(70, null), null);
  assert.equal(calculateBmi(70, 0), null);
});
