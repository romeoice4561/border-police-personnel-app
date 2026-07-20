import test from "node:test";
import assert from "node:assert/strict";
import {
  THAI_PERSONNEL_YEAR_BE_MAX,
  THAI_PERSONNEL_YEAR_BE_MIN,
  THAI_EXPIRY_YEAR_BE_MIN,
  THAI_EXPIRY_YEAR_BE_MAX,
} from "@/components/ui/thai_date_picker";
import { formatThaiPersonnelDate, parseThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import { yearGregorianToBE } from "@/lib/officer_profile/thai_date";

test("Thai personnel year range covers historical birth years", () => {
  assert.equal(THAI_PERSONNEL_YEAR_BE_MIN, 2500);
  assert.equal(THAI_PERSONNEL_YEAR_BE_MAX, 2575);
});

test("Thai personnel date displays DD/MM/YYYY Buddhist Era", () => {
  assert.equal(formatThaiPersonnelDate("1985-08-11"), "11/08/2528");
});

// Phase 47A — Thai Buddhist Calendar Date Picker (document expiry usage).

test("expiry year range is wide enough for multi-year-future documents and never overlaps in a way that breaks selection", () => {
  assert.ok(THAI_EXPIRY_YEAR_BE_MIN < THAI_EXPIRY_YEAR_BE_MAX);
  // Must comfortably cover "today" plus a decade+ of future expiry dates.
  const currentBE = yearGregorianToBE(new Date().getUTCFullYear());
  assert.ok(THAI_EXPIRY_YEAR_BE_MIN <= currentBE);
  assert.ok(THAI_EXPIRY_YEAR_BE_MAX >= currentBE + 10);
});

test("ISO output round-trips correctly through parseThaiPersonnelDate (the picker's internal parser, shared for both wire formats)", () => {
  // outputFormat="iso" produces plain yyyy-mm-dd, same as toISOString().slice(0,10).
  const date = new Date(Date.UTC(2026, 6, 20)); // 20 Jul 2026
  const isoOut = date.toISOString().slice(0, 10);
  assert.equal(isoOut, "2026-07-20");
  // The picker's display value always re-derives from parsing this ISO string.
  const reparsed = parseThaiPersonnelDate(isoOut);
  assert.equal(reparsed?.getUTCFullYear(), 2026);
  assert.equal(reparsed?.getUTCMonth(), 6);
  assert.equal(reparsed?.getUTCDate(), 20);
});

test("ISO value displays as DD/MM/YYYY Buddhist Era, never a Gregorian year", () => {
  const displayed = formatThaiPersonnelDate("2026-07-20");
  assert.equal(displayed, "20/07/2569");
  assert.ok(!displayed.includes("2026"));
});

test("an existing ISO expiry date parses correctly for pre-filling the picker on edit", () => {
  const parsed = parseThaiPersonnelDate("2030-01-13");
  assert.equal(parsed?.getUTCFullYear(), 2030);
  assert.equal(formatThaiPersonnelDate("2030-01-13"), "13/01/2573");
});

test("an empty value parses to null (picker shows placeholder, not a fabricated date)", () => {
  assert.equal(parseThaiPersonnelDate(""), null);
  assert.equal(parseThaiPersonnelDate(null), null);
});
