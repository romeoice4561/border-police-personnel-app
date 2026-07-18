/**
 * Training record history helper tests (Phase 45 completion pass, Task 14
 * items 7-8: "factual training history renders from actual fields only",
 * "year-only record does not fabricate a date").
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sortTrainingRowsChronologically, displayTrainingYear } from "@/lib/ui/training_history";
import type { Training } from "@/lib/database/query_types";

function row(overrides: Partial<Training> = {}): Training {
  return {
    id: 1,
    officerId: 1,
    year: null,
    course: "หลักสูตรทดสอบ",
    organization: "กก.ตชด.41",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Training;
}

test("7. factual training history sorts using only actual parseable years — never a guessed order", () => {
  const rows = [row({ id: 1, year: "2568" }), row({ id: 2, year: "2564" }), row({ id: 3, year: "2566" })];
  const sorted = sortTrainingRowsChronologically(rows);
  assert.deepEqual(sorted.map((r) => r.id), [2, 3, 1]);
});

test("rows without a parseable year sort LAST, keeping their relative input order (never guessed into a position)", () => {
  const rows = [row({ id: 1, year: "2563-2564" }), row({ id: 2, year: "2564" }), row({ id: 3, year: "ปัจจุบัน" })];
  const sorted = sortTrainingRowsChronologically(rows);
  // id 2 (parseable, 2564) sorts first; ids 1 and 3 (unparseable) keep their
  // original relative order at the end.
  assert.deepEqual(sorted.map((r) => r.id), [2, 1, 3]);
});

test("8. year-only record displays ONLY the Buddhist-Era year — never a fabricated full date", () => {
  const trainingRow = row({ year: "2564" });
  const display = displayTrainingYear(trainingRow, "2021-01-01", "ไม่ระบุปี");
  assert.equal(display, "พ.ศ. 2564");
  assert.doesNotMatch(display, /มกราคม|ม\.ค\./, "must never show a fabricated day/month");
});

test("a range/free-text year (e.g. a promotion span) with no parseable completionDate displays the RAW string verbatim, never reformatted", () => {
  const trainingRow = row({ year: "2563-2564" });
  const display = displayTrainingYear(trainingRow, null, "ไม่ระบุปี");
  assert.equal(display, "2563-2564");
});

test("a blank/null year displays the explicit unspecified-year label, never an empty string or a fabricated year", () => {
  const trainingRow = row({ year: null });
  const display = displayTrainingYear(trainingRow, null, "ไม่ระบุปี");
  assert.equal(display, "ไม่ระบุปี");
});

test("whitespace-only year is treated as blank, not displayed verbatim", () => {
  const trainingRow = row({ year: "   " });
  const display = displayTrainingYear(trainingRow, null, "ไม่ระบุปี");
  assert.equal(display, "ไม่ระบุปี");
});

test("empty rows array sorts to an empty array, no crash", () => {
  assert.deepEqual(sortTrainingRowsChronologically([]), []);
});

test("sorting does not mutate the input array", () => {
  const rows = [row({ id: 1, year: "2568" }), row({ id: 2, year: "2564" })];
  const original = [...rows];
  sortTrainingRowsChronologically(rows);
  assert.deepEqual(rows, original);
});
