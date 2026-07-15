import { test } from "node:test";
import assert from "node:assert/strict";

import { formatLocalizedDate, formatLocalizedYearBE, eraLabel, presentLabel } from "@/lib/i18n/format_date";

// Phase 43 — locale-aware dates (TH Buddhist Era / EN Gregorian A.D.).

test("Thai renders Buddhist Era year + Thai month; English renders Gregorian + A.D.", () => {
  const date = { day: 1, month: 1, yearBE: 2560 };
  assert.equal(formatLocalizedDate(date, "th"), "1 มกราคม 2560");
  assert.equal(formatLocalizedDate(date, "en"), "1 January 2017 A.D.");
});

test("year-only date degrades gracefully in both languages", () => {
  assert.equal(formatLocalizedDate({ yearBE: 2560 }, "th"), "2560");
  assert.equal(formatLocalizedDate({ yearBE: 2560 }, "en"), "2017 A.D.");
});

test("isPresent yields the localized present word", () => {
  assert.equal(formatLocalizedDate({ isPresent: true }, "th"), "ปัจจุบัน");
  assert.equal(formatLocalizedDate({ isPresent: true }, "en"), "Present");
});

test("unknown year returns an em dash", () => {
  assert.equal(formatLocalizedDate({ yearBE: null }, "th"), "—");
  assert.equal(formatLocalizedDate({}, "en"), "—");
});

test("formatLocalizedYearBE converts only for English", () => {
  assert.equal(formatLocalizedYearBE(2567, "th"), "2567");
  assert.equal(formatLocalizedYearBE(2567, "en"), "2024 A.D.");
  assert.equal(formatLocalizedYearBE(null, "en"), "—");
});

test("eraLabel and presentLabel are localized", () => {
  assert.equal(eraLabel("th"), "พ.ศ.");
  assert.equal(eraLabel("en"), "A.D.");
  assert.equal(presentLabel("th"), "ปัจจุบัน");
  assert.equal(presentLabel("en"), "Present");
});
