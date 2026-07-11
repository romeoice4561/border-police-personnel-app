import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MONTH_OPTIONS,
  THAI_MONTHS,
  YEAR_BE_OPTIONS,
  isValidDay,
  isValidMonth,
  isValidYearBE,
  yearBEToGregorian,
  yearGregorianToBE,
  toEffectiveDate,
  formatThaiDate,
  parseLegacyTimelineYear,
  currentYearBE,
} from "@/lib/officer_profile/thai_date";

test("MONTH_OPTIONS has exactly 12 entries, 1-indexed, matching THAI_MONTHS", () => {
  assert.equal(MONTH_OPTIONS.length, 12);
  assert.equal(MONTH_OPTIONS[0].value, 1);
  assert.equal(MONTH_OPTIONS[0].label, "มกราคม");
  assert.equal(MONTH_OPTIONS[11].value, 12);
  assert.equal(MONTH_OPTIONS[11].label, "ธันวาคม");
  assert.equal(THAI_MONTHS[1], "มกราคม");
});

test("YEAR_BE_OPTIONS is descending and covers a broad sane range", () => {
  assert.equal(YEAR_BE_OPTIONS[0], 2600);
  assert.equal(YEAR_BE_OPTIONS[YEAR_BE_OPTIONS.length - 1], 2470);
  assert.ok(YEAR_BE_OPTIONS.includes(2560));
});

test("isValidDay/isValidMonth/isValidYearBE reject out-of-range and non-integer values", () => {
  assert.equal(isValidDay(1), true);
  assert.equal(isValidDay(31), true);
  assert.equal(isValidDay(0), false);
  assert.equal(isValidDay(32), false);
  assert.equal(isValidDay(15.5), false);

  assert.equal(isValidMonth(1), true);
  assert.equal(isValidMonth(12), true);
  assert.equal(isValidMonth(0), false);
  assert.equal(isValidMonth(13), false);

  assert.equal(isValidYearBE(2560), true);
  assert.equal(isValidYearBE(2000), false);
  assert.equal(isValidYearBE(9999), false);
});

test("yearBEToGregorian / yearGregorianToBE round-trip (BE = CE + 543)", () => {
  assert.equal(yearBEToGregorian(2560), 2017);
  assert.equal(yearGregorianToBE(2017), 2560);
  assert.equal(yearBEToGregorian(yearGregorianToBE(2020)), 2020);
});

test("currentYearBE converts the given date's Gregorian year to Buddhist Era", () => {
  assert.equal(currentYearBE(new Date(Date.UTC(2026, 6, 7))), 2569);
  assert.equal(currentYearBE(new Date(Date.UTC(2000, 0, 1))), 2543);
});

test("toEffectiveDate defaults month/day to 1 when unknown, anchoring a year-only entry", () => {
  const d = toEffectiveDate({ yearBE: 2560 });
  assert.ok(d);
  assert.equal(d!.getUTCFullYear(), 2017);
  assert.equal(d!.getUTCMonth(), 0);
  assert.equal(d!.getUTCDate(), 1);
});

test("toEffectiveDate uses the full day/month/year when all three are known", () => {
  const d = toEffectiveDate({ day: 15, month: 6, yearBE: 2560 });
  assert.ok(d);
  assert.equal(d!.getUTCFullYear(), 2017);
  assert.equal(d!.getUTCMonth(), 5); // 0-indexed
  assert.equal(d!.getUTCDate(), 15);
});

test("toEffectiveDate returns null when yearBE is unknown", () => {
  assert.equal(toEffectiveDate({ day: 1, month: 1, yearBE: null }), null);
  assert.equal(toEffectiveDate({}), null);
});

test("formatThaiDate renders full date, month+year, year-only, and ปัจจุบัน correctly", () => {
  assert.equal(formatThaiDate({ day: 1, month: 1, yearBE: 2560 }), "1 มกราคม 2560");
  assert.equal(formatThaiDate({ month: 1, yearBE: 2560 }), "มกราคม 2560");
  assert.equal(formatThaiDate({ yearBE: 2560 }), "2560");
  assert.equal(formatThaiDate({ isPresent: true }), "ปัจจุบัน");
  assert.equal(formatThaiDate({}), "—");
});

test("parseLegacyTimelineYear: 4-digit year-only", () => {
  assert.deepEqual(parseLegacyTimelineYear("2560"), { day: null, month: null, yearBE: 2560, isPresent: false });
});

test("parseLegacyTimelineYear: year range with ปัจจุบัน anchors the start year and sets isPresent", () => {
  assert.deepEqual(parseLegacyTimelineYear("2567-ปัจจุบัน"), { day: null, month: null, yearBE: 2567, isPresent: true });
});

test("parseLegacyTimelineYear: bare ปัจจุบัน with no anchor year", () => {
  assert.deepEqual(parseLegacyTimelineYear("ปัจจุบัน"), { day: null, month: null, yearBE: null, isPresent: true });
});

test("parseLegacyTimelineYear: full Thai date with 4-digit BE year and a period-abbreviated month", () => {
  assert.deepEqual(parseLegacyTimelineYear("1 ก.พ. 2532"), { day: 1, month: 2, yearBE: 2532, isPresent: false });
});

test("parseLegacyTimelineYear: full Thai date with no space before a 4-digit year", () => {
  assert.deepEqual(parseLegacyTimelineYear("7 ธ.ค.2566"), { day: 7, month: 12, yearBE: 2566, isPresent: false });
});

test("parseLegacyTimelineYear: full Thai date with a 2-digit BE year shorthand", () => {
  assert.deepEqual(parseLegacyTimelineYear("1 พ.ค. 60"), { day: 1, month: 5, yearBE: 2560, isPresent: false });
});

test("parseLegacyTimelineYear: 2-digit year with no space before it", () => {
  assert.deepEqual(parseLegacyTimelineYear("16 ก.พ.58"), { day: 16, month: 2, yearBE: 2558, isPresent: false });
});

test("parseLegacyTimelineYear: empty/blank input returns all-null, never guesses", () => {
  assert.deepEqual(parseLegacyTimelineYear(""), { day: null, month: null, yearBE: null, isPresent: false });
  assert.deepEqual(parseLegacyTimelineYear("   "), { day: null, month: null, yearBE: null, isPresent: false });
});

test("parseLegacyTimelineYear: unrecognized free text returns all-null rather than guessing", () => {
  assert.deepEqual(parseLegacyTimelineYear("บรรจุใหม่"), { day: null, month: null, yearBE: null, isPresent: false });
});

test("parseLegacyTimelineYear: a 4-digit year outside the sane BE range is rejected, not silently misparsed", () => {
  assert.deepEqual(parseLegacyTimelineYear("1234"), { day: null, month: null, yearBE: null, isPresent: false });
});

test("parseLegacyTimelineYear: a plain year range with no ปัจจุบัน anchors the start year, not present", () => {
  assert.deepEqual(parseLegacyTimelineYear("2563-2564"), { day: null, month: null, yearBE: 2563, isPresent: false });
});

test("parseLegacyTimelineYear: month + 4-digit year with no day", () => {
  assert.deepEqual(parseLegacyTimelineYear("ธ.ค. 2558"), { day: null, month: 12, yearBE: 2558, isPresent: false });
  assert.deepEqual(parseLegacyTimelineYear("ธ.ค.2558"), { day: null, month: 12, yearBE: 2558, isPresent: false });
});

test("parseLegacyTimelineYear: a full-date-to-ปัจจุบัน range anchors the full start date and sets isPresent", () => {
  assert.deepEqual(parseLegacyTimelineYear("16 ก.ย. 2556 - ปัจจุบัน"), { day: 16, month: 9, yearBE: 2556, isPresent: true });
});

test("parseLegacyTimelineYear: a full-date-to-ปัจจุบัน range with a 2-digit BE year", () => {
  assert.deepEqual(parseLegacyTimelineYear("28 พ.ย.68 - ปัจจุบัน"), { day: 28, month: 11, yearBE: 2568, isPresent: true });
});
