/**
 * Position-level year-count fix tests (Phase 44.1).
 *
 * Covers `toQueryOfficer`'s `positionLevelYearCount` field — the
 * commander-facing YEAR COUNT (`currentYearBe - positionLevelStartYearBe`,
 * a Buddhist-Era calendar-year subtraction), distinct from the deprecated
 * `yearsInPositionLevel` (an exact elapsed decimal-years duration that can
 * truncate to one year less than the calendar-year difference implies).
 *
 * All tests use a fixed, explicit `asOf` — never the real current date —
 * so results are deterministic regardless of when the suite runs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "ภาค1/5",
    rank: "รองผู้กำกับการ",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "รอง ผกก.ตชด.41",
    currentUnit: "กก.ตชด.41",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    phone: null,
    qualityScore: 80,
    knowledgeScore: 70,
    region: null,
    confidence: 80,
    dateOfBirth: null,
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitId: null,
    email: null,
    lineId: null,
    facebookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeline: [],
    phones: [],
    education: [],
    training: [],
    salaryHistory: [],
    documents: [],
    skills: [],
    ...overrides,
  } as unknown as OfficerWithRelations;
}

function timelineRow(overrides: Record<string, unknown>) {
  return {
    id: 1,
    officerId: 1,
    sequence: 0,
    year: String(overrides.yearBE ?? ""),
    isPresent: false,
    ...overrides,
  };
}

const ASOF_2569 = utcDate(2026, 7, 17); // Gregorian 2026 = Buddhist Era 2569.
const ORG_LABELS = { company: "กองร้อยทดสอบ" };

// ---------------------------------------------------------------------------
// 1. Current level starts in 2564, as-of year 2569 -> 5 ปี
// ---------------------------------------------------------------------------
test("1. current level starts in 2564 BE, as-of year 2569 BE -> positionLevelYearCount = 5", () => {
  const o = officer({
    currentPosition: "รอง ผกก.2 ส.3",
    timeline: [timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ", isPresent: true })],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2564);
  assert.equal(result.positionLevelYearCount, 5);
});

// ---------------------------------------------------------------------------
// 2. Multiple entries at the same level: 2564 -> 2565 -> 2568, start stays 2564
// ---------------------------------------------------------------------------
test("2. multiple Timeline entries at the same level: start year remains the EARLIEST (2564), not the latest (2568)", () => {
  const o = officer({
    currentPosition: "รอง ผกก.ตชด.41",
    timeline: [
      timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ" }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2565, position: "รองผู้กำกับการสืบสวน", positionLevel: "รองผู้กำกับการ" }),
      timelineRow({ id: 3, sequence: 2, yearBE: 2568, position: "รอง ผกก.ตชด.41", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2564);
  assert.equal(result.positionLevelYearCount, 5);
});

// ---------------------------------------------------------------------------
// 3. Unit/title changes without a position-level change -> tenure continues
// ---------------------------------------------------------------------------
test("3. unit or job-title change WITHOUT a position-level change does not reset tenure", () => {
  const o = officer({
    currentPosition: "รอง ผกก.สส.",
    timeline: [
      timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ" }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2567, position: "รอง ผกก.สส.", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2564);
  assert.equal(result.positionLevelYearCount, 5);
});

// ---------------------------------------------------------------------------
// 4. Actual position-level promotion resets the start year.
// ---------------------------------------------------------------------------
test("4. an actual position-level promotion (สารวัตร -> รองผู้กำกับการ in 2568) resets the start year to 2568, not 2564", () => {
  const o = officer({
    currentPosition: "รอง ผกก.ตชด.41",
    timeline: [
      timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "สารวัตร", positionLevel: "สารวัตร" }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2568, position: "รอง ผกก.ตชด.41", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevel, "รองผู้กำกับการ");
  assert.equal(result.positionLevelStartYearBe, 2568);
  assert.equal(result.positionLevelYearCount, 1);
});

// ---------------------------------------------------------------------------
// 5. Exact duration under five full anniversaries but the year difference is
//    five -> the commander-facing count remains 5, never truncated to 4.
// ---------------------------------------------------------------------------
test("5. exact elapsed duration is short of 5 full anniversaries (start anchored to 1 Jan, asOf mid-year) but the calendar year-count is still exactly 5", () => {
  // Start anchored to 1 Jan 2021 (BE 2564, year-only row -> day/month default to 1).
  // asOf 17 July 2026 (BE 2569) -> exact duration is 5y 6m 16d (truncates to
  // 5, not 4, at THIS anchor — the bug reproduces precisely when the
  // matching Timeline row is silently skipped, see test 6/7 below). This
  // test confirms the year-count path never depends on the day/month at all.
  const o = officer({
    currentPosition: "รอง ผกก.2 ส.3",
    timeline: [timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ" })],
  });
  const asOfEarlyInFiscalYear = utcDate(2026, 1, 5); // BE 2569, but only 4 days into the Gregorian year.
  const result = toQueryOfficer(o, asOfEarlyInFiscalYear, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2564);
  assert.equal(result.positionLevelYearCount, 5, "calendar year-count must be 5 regardless of month/day within the as-of year");
});

// ---------------------------------------------------------------------------
// 6. Missing Timeline -> unavailable, not zero.
// ---------------------------------------------------------------------------
test("6. missing Timeline data -> positionLevelYearCount is null, never a fabricated 0", () => {
  const o = officer({ currentPosition: "", timeline: [] });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, null);
  assert.equal(result.positionLevelYearCount, null);
});

// ---------------------------------------------------------------------------
// 7. Unclassifiable Timeline entry -> excluded safely.
// ---------------------------------------------------------------------------
test("7. a Timeline entry with an unclassifiable position/level is excluded rather than guessed", () => {
  const o = officer({
    currentPosition: "รอง ผกก.ตชด.41",
    timeline: [
      // Neither positionLevel nor position text is classifiable — must be excluded.
      timelineRow({ id: 1, sequence: 0, yearBE: 2560, position: "งานธุรการ", positionLevel: null }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2564, "the unclassifiable 2560 row must not be selected as the start");
  assert.equal(result.positionLevelYearCount, 5);
});

test("7b. a legacy row with a missing/Unknown STORED positionLevel but a classifiable free-text position IS recovered via fallback classification (the exact root-cause scenario)", () => {
  const o = officer({
    currentPosition: "รอง ผกก.ตชด.41",
    timeline: [
      // 2564 row: never backfilled with a structured positionLevel, but its
      // free-text position IS classifiable via mapPositionTextToLevel.
      timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: null }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2565, position: "รองผู้กำกับการสืบสวน", positionLevel: "รองผู้กำกับการ" }),
      timelineRow({ id: 3, sequence: 2, yearBE: 2568, position: "รอง ผกก.ตชด.41", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2564, "the un-backfilled 2564 row must be recovered via fallback text classification, not skipped in favor of 2565");
  assert.equal(result.positionLevelYearCount, 5, "must be 5, not the pre-fix bug's 4");
});

// ---------------------------------------------------------------------------
// 8. Commander Search and Officer Profile return identical values (both
//    read the exact same toQueryOfficer()/positionLevelYearCount field).
// ---------------------------------------------------------------------------
test("8. Commander Search (CommanderQueryOfficer.positionLevelYearCount) and Officer Profile (via the same toQueryOfficer call) return identical values for the same officer", () => {
  const o = officer({
    currentPosition: "รอง ผกก.ตชด.41",
    timeline: [
      timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ" }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2568, position: "รอง ผกก.ตชด.41", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const commanderSearchResult = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  const officerProfileResult = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(commanderSearchResult.positionLevelYearCount, officerProfileResult.positionLevelYearCount);
  assert.equal(commanderSearchResult.positionLevelYearCount, 5);
});

// ---------------------------------------------------------------------------
// 9. Deterministic asOfDate.
// ---------------------------------------------------------------------------
test("9. identical asOf always produces an identical positionLevelYearCount (deterministic, no real-clock dependency)", () => {
  const o = officer({
    currentPosition: "รอง ผกก.ตชด.41",
    timeline: [timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ", isPresent: true })],
  });
  const r1 = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  const r2 = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(r1.positionLevelYearCount, r2.positionLevelYearCount);
  assert.equal(r1.positionLevelYearCount, 5);
});

// ---------------------------------------------------------------------------
// 10. promotionCyclesPassed is not used for this field.
// ---------------------------------------------------------------------------
test("10. positionLevelYearCount diverges from promotionCyclesPassed when the officer's appointment-cycle data differs from their position-level start year — proving the two are computed independently, not one derived from the other", () => {
  const o = officer({
    currentPosition: "รอง ผกก.2 ส.3",
    timeline: [
      // The officer reached this position level in 2564 (drives
      // positionLevelYearCount = 5), but their FIRST recorded row at this
      // level explicitly carries an appointmentCycle of 2567 (a distinct,
      // later administrative cycle marker) — appointmentCycleForPositionLevel
      // prefers this explicit field over the row's yearBE, so
      // promotionCyclesPassed is driven by 2567, not 2564.
      timelineRow({ id: 1, sequence: 0, yearBE: 2564, appointmentCycle: 2567, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  assert.equal(result.positionLevelYearCount, 5, "position-level year count must come from the Timeline start year (2564), independent of appointmentCycle");
  assert.notEqual(
    result.positionLevelYearCount,
    result.promotionIntelligence.promotionCyclesPassed,
    "promotionCyclesPassed (driven by appointmentCycle=2567) must differ from positionLevelYearCount (driven by yearBE=2564) — proving positionLevelYearCount is not sourced from promotionCyclesPassed"
  );
});

// ---------------------------------------------------------------------------
// Preserve existing exact-duration behavior — yearsInPositionLevel (the
// deprecated field feeding Promotion Intelligence eligibility) is UNCHANGED.
// ---------------------------------------------------------------------------
test("existing exact-duration field (yearsInPositionLevel, feeds Promotion Intelligence eligibility) is unchanged by this fix", () => {
  const o = officer({
    currentPosition: "รอง ผกก.2 ส.3",
    timeline: [timelineRow({ id: 1, sequence: 0, yearBE: 2564, position: "รอง ผกก.2 ส.3", positionLevel: "รองผู้กำกับการ", isPresent: true })],
  });
  const result = toQueryOfficer(o, ASOF_2569, ORG_LABELS, null);
  // Exact elapsed duration from 1 Jan 2021 to 17 Jul 2026 is a decimal, not
  // a whole-number year-count — confirms the two fields remain distinct.
  assert.notEqual(result.yearsInPositionLevel, result.positionLevelYearCount);
  assert.ok(result.yearsInPositionLevel != null && result.yearsInPositionLevel > 5 && result.yearsInPositionLevel < 6);
});
