/**
 * Unit tests for the officer detail presentation helpers (Phase 15A):
 * full-name fallback, the AI Quality Summary phrasing, and year-sorted
 * timeline. Pure — no DB, no React.
 *
 * Run with:
 *   npx tsx --test lib/ui/__tests__/officer_summary.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildQualitySummary, officerFullName, sortTimelineByYear } from "@/lib/ui/officer_summary";
import type { OfficerWithRelations, Timeline } from "@/lib/database/query_types";

/** Builds a Timeline row with the Phase 23A/26B fields defaulted, so fixtures only specify what they test. */
function timelineRow(ov: Partial<Timeline> & { id: number; officerId: number; sequence: number; year: string; position: string }): Timeline {
  return {
    yearValue: null,
    rank: null,
    unit: null,
    source: null,
    verified: "ยังไม่ตรวจ",
    day: null,
    month: null,
    yearBE: null,
    isPresent: false,
    effectiveDate: null,
    ...ov,
  };
}

function officer(ov: Partial<OfficerWithRelations> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "ภาค1/5",
    rank: "ร.ต.ท.",
    firstName: "อนิรุทธิ์",
    lastName: "ขาวจันทร์คง",
    currentPosition: "ผบ.ร้อย",
    currentUnit: "ตชด.447",
    phone: "081-540-7336",
    careerYears: 19,
    qualityScore: 90,
    knowledgeScore: 80,
    region: "ภาค1",
    confidence: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeline: [timelineRow({ id: 1, officerId: 1, sequence: 0, year: "2564", yearValue: 2564, position: "ผบ.ร้อย", unit: "ตชด.447" })],
    phones: [{ id: 1, officerId: 1, number: "081-540-7336" }],
    ...ov,
  } as OfficerWithRelations;
}

test("officerFullName joins first + last, falls back to officerId when blank", () => {
  assert.equal(officerFullName(officer()), "อนิรุทธิ์ ขาวจันทร์คง");
  assert.equal(officerFullName(officer({ firstName: "", lastName: "  " })), "ภาค1/5");
});

test("quality summary states the band + score for a complete high-quality record", () => {
  const summary = buildQualitySummary(officer({ qualityScore: 95, knowledgeScore: 90 }));
  assert.match(summary, /excellent \(95\/100\)/);
  assert.match(summary, /knowledge confidence is 90\/100/);
  assert.match(summary, /complete and ready/);
});

test("quality summary lists missing fields without inventing them", () => {
  const summary = buildQualitySummary(
    officer({ currentPosition: "", phone: null, timeline: [] })
  );
  assert.match(summary, /Missing/);
  assert.match(summary, /current position/);
  assert.match(summary, /phone/);
  assert.match(summary, /career timeline/);
  assert.doesNotMatch(summary, /complete and ready/);
});

test("quality summary flags low extraction confidence for review", () => {
  const summary = buildQualitySummary(officer({ confidence: 55 }));
  assert.match(summary, /Low extraction confidence/);
  assert.match(summary, /human review/);
});

test("quality summary handles a missing quality score", () => {
  const summary = buildQualitySummary(officer({ qualityScore: null }));
  assert.match(summary, /no quality score/);
});

test("sortTimelineByYear orders newest → oldest by yearValue", () => {
  const rows: Timeline[] = [
    timelineRow({ id: 1, officerId: 1, sequence: 0, year: "2554", yearValue: 2554, position: "a" }),
    timelineRow({ id: 2, officerId: 1, sequence: 1, year: "2564", yearValue: 2564, position: "b" }),
    timelineRow({ id: 3, officerId: 1, sequence: 2, year: "2560", yearValue: 2560, position: "c" }),
  ];
  assert.deepEqual(sortTimelineByYear(rows).map((r) => r.yearValue), [2564, 2560, 2554]);
});

test("entries without a parseable year sort last, keeping their sequence", () => {
  const rows: Timeline[] = [
    timelineRow({ id: 1, officerId: 1, sequence: 0, year: "ปัจจุบัน", yearValue: null, position: "present" }),
    timelineRow({ id: 2, officerId: 1, sequence: 1, year: "2564", yearValue: 2564, position: "b" }),
    timelineRow({ id: 3, officerId: 1, sequence: 2, year: "", yearValue: null, position: "c" }),
  ];
  const sorted = sortTimelineByYear(rows);
  assert.equal(sorted[0].yearValue, 2564); // dated first
  assert.equal(sorted[1].id, 1); // then nulls in original sequence
  assert.equal(sorted[2].id, 3);
});

test("Phase 26B: an isPresent entry always sorts first, ahead of any dated entry", () => {
  const rows: Timeline[] = [
    timelineRow({ id: 1, officerId: 1, sequence: 0, year: "2564", yearValue: 2564, position: "dated" }),
    timelineRow({ id: 2, officerId: 1, sequence: 1, year: "2560-ปัจจุบัน", yearBE: 2560, isPresent: true, position: "ongoing" }),
  ];
  const sorted = sortTimelineByYear(rows);
  assert.equal(sorted[0].id, 2, "the ongoing entry sorts first even though its own start year is older");
});

test("Phase 26B: a row migrated to effectiveDate sorts by the precise date, not just the year (day/month-aware)", () => {
  const rows: Timeline[] = [
    timelineRow({ id: 1, officerId: 1, sequence: 0, year: "2560", yearValue: 2560, position: "legacy-year-only" }),
    timelineRow({
      id: 2,
      officerId: 1,
      sequence: 1,
      year: "1 มิถุนายน 2560",
      yearBE: 2560,
      month: 6,
      day: 1,
      effectiveDate: new Date(Date.UTC(2017, 5, 1)),
      position: "structured-mid-year",
    }),
  ];
  const sorted = sortTimelineByYear(rows);
  // Legacy year-only row keys to Jan 1 of that year (Date.UTC(2560-543, 0, 1)) which is EARLIER than June 1 of the same year.
  assert.equal(sorted[0].id, 2, "the mid-year structured date sorts ahead of the same year's Jan-1 fallback");
  assert.equal(sorted[1].id, 1);
});

test("sortTimelineByYear does not mutate the input array", () => {
  const rows: Timeline[] = [
    timelineRow({ id: 1, officerId: 1, sequence: 0, year: "2554", yearValue: 2554, position: "a" }),
    timelineRow({ id: 2, officerId: 1, sequence: 1, year: "2564", yearValue: 2564, position: "b" }),
  ];
  const snapshot = rows.map((r) => r.id);
  sortTimelineByYear(rows);
  assert.deepEqual(rows.map((r) => r.id), snapshot);
});
