import { test } from "node:test";
import assert from "node:assert/strict";

import { extractDate } from "@/lib/extraction/date_extraction";

test("extracts a numeric DD/MM/YYYY date in Buddhist Era and converts to ISO Gregorian", () => {
  const result = extractDate("วันเกิด 20/07/2568");
  assert.ok(result);
  assert.equal(result!.normalizedValue, "2025-07-20");
  assert.match(result!.reason, /Buddhist Era 2568/);
});

test("extracts a dash-separated date", () => {
  const result = extractDate("issued 01-01-2568");
  assert.equal(result?.normalizedValue, "2025-01-01");
});

test("treats a plausible Gregorian year as already-Gregorian, not double-converted", () => {
  const result = extractDate("date 15/06/2025");
  assert.equal(result?.normalizedValue, "2025-06-15");
  assert.match(result!.reason, /already in plausible Gregorian range/);
});

test("extracts a Thai month-name date", () => {
  const result = extractDate("1 มกราคม 2568");
  assert.ok(result);
  assert.equal(result!.normalizedValue, "2025-01-01");
});

test("extracts a Thai month-abbreviation date", () => {
  const result = extractDate("15 ส.ค. 2568");
  assert.ok(result);
  assert.equal(result!.normalizedValue, "2025-08-15");
});

test("returns null when no date pattern is found at all", () => {
  assert.equal(extractDate("no dates here whatsoever"), null);
});

test("returns a non-null result with normalizedValue=null for an out-of-range day/month (never silently guesses)", () => {
  const result = extractDate("32/13/2568");
  assert.ok(result);
  assert.equal(result!.normalizedValue, null);
  assert.ok(result!.reason.length > 0);
});

test("returns normalizedValue=null for an implausible year", () => {
  const result = extractDate("01/01/9999");
  assert.ok(result);
  assert.equal(result!.normalizedValue, null);
});

test("returns normalizedValue=null for an unrecognized Thai month name", () => {
  const result = extractDate("1 xxxxx 2568");
  assert.equal(result, null); // doesn't match the Thai-month pattern shape at all since "xxxxx" isn't Thai script
});
