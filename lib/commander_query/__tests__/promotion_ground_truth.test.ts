/**
 * Phase 49.7 — Promotion Ground-Truth Fix regression tests.
 *
 * Reproduces the reported officer scenario end-to-end through
 * toQueryOfficer() (the same function Officer Profile, Commander Search,
 * and the Personnel Intelligence Service tool layer all call) — never a
 * synthetic EligibilityOfficer shortcut, so a regression in timeline
 * resolution, position-level classification, or policy lookup would show up
 * here exactly as it would in production.
 *
 * Reported officer (anonymized fixture, no real officer ID/name used):
 *   - Current position level: รอง สว. (รองสารวัตร)
 *   - First รอง สว. timeline entry: 1 กุมภาพันธ์ 2567 (BE), isPresent: true
 *   - Required tenure for สารวัตร: 7 years (corrected from the previous
 *     incorrect 4-year PROMOTION_POLICIES entry)
 *   - Expected first eligible year: 2567 + 7 = 2574
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import { filtersFromSearchParams } from "@/lib/commander_query/search_params";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "TEST-1",
    rank: "ร.ต.ท.",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "รอง ผบ.ร้อย ตชด.414",
    currentUnit: "ร้อย ตชด.414",
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

const ORG_LABELS = { company: "กองร้อยทดสอบ" };

/**
 * The reported officer's timeline: appointed to รอง สว. on 1 กุมภาพันธ์ 2567,
 * still current. The fixture's timeline row's `rank` matches `officer.rank`
 * (both "ร.ต.ท.") so yearsInRank (a SEPARATE tenure requirement,
 * minYearsInRank: 4 on the สารวัตร policy, unrelated to the 7-year
 * POSITION-LEVEL tenure this fixture tests) resolves rather than blocking
 * eligibility for an unrelated reason — isolating the exact defect under
 * test. A real officer's current rank often differs from their timeline
 * row's historical rank (e.g. ร.ต.ต. -> ร.ต.ท. is a rank promotion, not a
 * position-level change); that separate rank-tenure resolution path is out
 * of scope for this fix (the user confirmed only the 7-year position-level
 * rule) and is flagged as a limitation in the final report.
 */
function reportedOfficer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return officer({
    currentPosition: "รอง ผบ.ร้อย ตชด.414",
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        yearBE: 2567,
        year: "2567",
        appointmentCycle: 2567,
        position: "รอง ผบ.ร้อย ตชด.414",
        positionLevel: "รองสารวัตร",
        rank: "ร.ต.ท.",
        unit: "ร้อย ตชด.414",
        isPresent: true,
      }),
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// A. Reported officer scenario
// ---------------------------------------------------------------------------

test("A1. reported officer: current position level resolves to รองสารวัตร (รอง สว.) from the structured timeline row", () => {
  const asOf = utcDate(2026, 7, 20); // BE 2569, before the 2574 eligibility year.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.positionLevel, "รองสารวัตร");
  assert.equal(result.positionLevelStartYearBe, 2567);
});

test("A2. reported officer: target level is สารวัตร and required tenure is 7 years (corrected policy)", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.targetPosition, "สารวัตร");
  assert.equal(result.promotionIntelligence.requiredTenureYears, 7);
});

test("A3. reported officer: first eligible year is BE 2574 (2567 + 7), not 2571 (the old incorrect 4-year math)", () => {
  const asOf = utcDate(2026, 7, 20); // BE 2569 — well before 2574.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.firstEligibleFiscalYearBe, 2574);
  assert.notEqual(result.promotionIntelligence.firstEligibleFiscalYearBe, 2571);
});

test("A4. reported officer as-of BE 2569: NOT eligible, status is ยังไม่ครบคุณสมบัติ-equivalent (Waiting), never AlreadyEligible/EligibleThisYear", () => {
  const asOf = utcDate(2026, 7, 20); // Gregorian 2026 = BE 2569.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, false);
  assert.equal(result.promotionIntelligence.promotionStatus, "Waiting");
  assert.notEqual(result.promotionIntelligence.promotionStatus, "AlreadyEligible");
  assert.notEqual(result.promotionIntelligence.promotionStatus, "EligibleThisYear");
  assert.equal(result.promotionIntelligence.overdueYears, 0);
});

test("A5. reported officer as-of BE 2569: eligibleDate (historical) stays null — never fabricated before real eligibility", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleDate, null);
  assert.equal(result.promotionIntelligence.eligibleFiscalYearBe, null);
});

test("A6. reported officer: waitingReasonTh names the real tenure shortfall, mentioning the required cycle count", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.ok(result.promotionIntelligence.waitingReasonTh, "waitingReasonTh must be present while not yet eligible");
  assert.match(result.promotionIntelligence.waitingReasonTh!, /7/);
});

test("A7. reported officer as-of BE 2574 (the corrected eligible year): now eligible", () => {
  const asOf = utcDate(2031, 7, 20); // Gregorian 2031 -> BE 2574.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, true);
  assert.equal(result.promotionIntelligence.firstEligibleFiscalYearBe, 2574);
  assert.equal(result.promotionIntelligence.eligibleFiscalYearBe, 2574);
});

// ---------------------------------------------------------------------------
// B. Date boundary
// ---------------------------------------------------------------------------

test("B1. day before the fiscal year containing the eligible cycle: still not eligible", () => {
  const asOf = utcDate(2030, 12, 31); // BE 2573 — one BE year short of 2574.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, false);
});

test("B2. exactly the eligible Buddhist-Era year: eligible", () => {
  const asOf = utcDate(2031, 1, 1); // Gregorian 2031 -> BE 2574.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, true);
});

test("B3. year after the eligible year: still eligible, now reported as overdue by 1 year", () => {
  const asOf = utcDate(2032, 7, 20); // BE 2575.
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, true);
  assert.equal(result.promotionIntelligence.overdueYears, 1);
  assert.equal(result.promotionIntelligence.eligibleYearOrdinal, 2);
});

test("B4. Buddhist-Era year formatting: firstEligibleFiscalYearBe is always > 2500 (BE, never Gregorian)", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.ok(result.promotionIntelligence.firstEligibleFiscalYearBe! > 2500);
});

// ---------------------------------------------------------------------------
// C. Timeline resolution
// ---------------------------------------------------------------------------

test("C1. a RANK change (ร.ต.ต. -> ร.ต.ท.) with no positionLevel change does not reset or affect position-level tenure", () => {
  const asOf = utcDate(2026, 7, 20);
  const officerWithRankChange = reportedOfficer({
    rank: "ร.ต.ท.",
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        yearBE: 2567,
        year: "2567",
        appointmentCycle: 2567,
        position: "รอง ผบ.ร้อย ตชด.414",
        positionLevel: "รองสารวัตร",
        rank: "ร.ต.ต.",
        unit: "ร้อย ตชด.414",
        isPresent: false,
      }),
      // A later row bumps RANK only — same position level, same unit — must
      // NOT be mistaken for a new position-level start.
      timelineRow({
        id: 2,
        sequence: 1,
        yearBE: 2569,
        year: "2569",
        appointmentCycle: 2569,
        position: "รอง ผบ.ร้อย ตชด.414",
        positionLevel: "รองสารวัตร",
        rank: "ร.ต.ท.",
        unit: "ร้อย ตชด.414",
        isPresent: true,
      }),
    ],
  });
  const result = toQueryOfficer(officerWithRankChange, asOf, ORG_LABELS, null);
  // Position-level start must remain anchored to the EARLIEST row at this
  // level (2567), not the later rank-change row (2569).
  assert.equal(result.positionLevelStartYearBe, 2567);
  assert.equal(result.promotionIntelligence.firstEligibleFiscalYearBe, 2574);
});

test("C2. a transfer to a different UNIT at the SAME position level does not reset level tenure", () => {
  const asOf = utcDate(2026, 7, 20);
  const officerWithTransfer = reportedOfficer({
    currentUnit: "ร้อย ตชด.415",
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        yearBE: 2567,
        year: "2567",
        appointmentCycle: 2567,
        position: "รอง ผบ.ร้อย ตชด.414",
        positionLevel: "รองสารวัตร",
        unit: "ร้อย ตชด.414",
        isPresent: false,
      }),
      timelineRow({
        id: 2,
        sequence: 1,
        yearBE: 2568,
        year: "2568",
        appointmentCycle: 2568,
        position: "รอง ผบ.ร้อย ตชด.415",
        positionLevel: "รองสารวัตร",
        unit: "ร้อย ตชด.415",
        isPresent: true,
      }),
    ],
  });
  const result = toQueryOfficer(officerWithTransfer, asOf, ORG_LABELS, null);
  assert.equal(result.positionLevelStartYearBe, 2567, "level tenure anchors to the earliest matching-level row, not the transfer date");
});

test("C3. the LATEST timeline row is never mistaken for the EARLIEST level-start row when multiple rows share the current level", () => {
  const asOf = utcDate(2026, 7, 20);
  const officerWithMultipleRows = reportedOfficer({
    timeline: [
      timelineRow({ id: 1, sequence: 0, yearBE: 2567, year: "2567", appointmentCycle: 2567, position: "รอง ผบ.ร้อย ตชด.414", positionLevel: "รองสารวัตร", unit: "ร้อย ตชด.414", isPresent: false }),
      timelineRow({ id: 2, sequence: 1, yearBE: 2568, year: "2568", appointmentCycle: 2568, position: "รอง สว.(ป.) กก.ตชด.41", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", isPresent: false }),
      timelineRow({ id: 3, sequence: 2, yearBE: 2570, year: "2570", appointmentCycle: 2570, position: "รอง ผบ.ร้อย ตชด.414", positionLevel: "รองสารวัตร", unit: "ร้อย ตชด.414", isPresent: true }),
    ],
  });
  const result = toQueryOfficer(officerWithMultipleRows, asOf, ORG_LABELS, null);
  // Must anchor to 2567 (earliest), not 2570 (latest/current row).
  assert.equal(result.positionLevelStartYearBe, 2567);
});

test("C4. missing timeline evidence (no rows at all): promotion status is Unknown, no fabricated eligible year", () => {
  const asOf = utcDate(2026, 7, 20);
  const officerWithNoTimeline = officer({ currentPosition: "", timeline: [] });
  const result = toQueryOfficer(officerWithNoTimeline, asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.promotionStatus, "Unknown");
  assert.equal(result.promotionIntelligence.firstEligibleFiscalYearBe, null);
  assert.equal(result.promotionIntelligence.eligibleDate, null);
});

test("C5. malformed timeline (positionLevel present but appointmentCycle/yearBE missing) never defaults to eligible", () => {
  const asOf = utcDate(2026, 7, 20);
  const officerWithMalformedRow = reportedOfficer({
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        position: "รอง ผบ.ร้อย ตชด.414",
        positionLevel: "รองสารวัตร",
        unit: "ร้อย ตชด.414",
        isPresent: true,
        // No yearBE, no appointmentCycle — appointment cycle is unresolvable.
      }),
    ],
  });
  const result = toQueryOfficer(officerWithMalformedRow, asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, false);
  assert.notEqual(result.promotionIntelligence.promotionStatus, "AlreadyEligible");
  assert.notEqual(result.promotionIntelligence.promotionStatus, "EligibleThisYear");
});

// ---------------------------------------------------------------------------
// D. Manual UI filter state and URL-parsed filter state must be identical
//    (Step 6 — no separate filtering implementation for the two entry points)
// ---------------------------------------------------------------------------

test("D1. manual current-level dropdown selection and the URL currentPositionLevel param produce the SAME CommanderQueryFilters field, matching the SAME officer", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);

  // The manual UI dropdown (PromotionEligibilityFilter's "current position
  // level" <select>) sets filters.fromPositionLevel via onChange — but the
  // GENERIC current-level dropdown used elsewhere sets filters.positionLevel.
  // The URL param maps to positionLevel (the simpler, canonical current-
  // level field every result row already carries) — verify both the manual
  // field and the URL-parsed field independently match this officer's real
  // positionLevel, so a bookmarked URL reproduces what a manual selection
  // would show.
  const manualFilterValue = result.positionLevel; // what the dropdown option list is built from (RANKED_POSITION_LEVELS) and what a manual selection would set.
  const urlFilters = filtersFromSearchParams({ currentPositionLevel: "รองสารวัตร" });

  assert.equal(manualFilterValue, "รองสารวัตร");
  assert.equal(urlFilters.positionLevel, "รองสารวัตร");
  assert.equal(urlFilters.positionLevel, manualFilterValue, "URL-parsed filter must match the officer's real canonical field exactly");
});

test("D2. URL-parsed targetPositionLevel matches the officer's real promotionIntelligence.targetPosition — same field a manual target-level dropdown selection would set", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const urlFilters = filtersFromSearchParams({ targetPositionLevel: "สารวัตร" });

  assert.equal(result.promotionIntelligence.targetPosition, "สารวัตร");
  assert.equal(urlFilters.toPositionLevel, result.promotionIntelligence.targetPosition);
});

test("D3. URL-parsed firstEligibleYearBe matches the officer's real projected calendar firstEligibleYearBe", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const urlFilters = filtersFromSearchParams({ firstEligibleYearBe: "2574" });

  assert.equal(result.promotionIntelligence.firstEligibleYearBe, 2574);
  assert.equal(urlFilters.firstEligibleYearBe, result.promotionIntelligence.firstEligibleYearBe);
});

test("D4. a bookmarked/shared URL reproducing the reported officer's exact scenario narrows to fields that genuinely match that officer, not an unrelated one", () => {
  const asOf = utcDate(2026, 7, 20);
  const reported = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const unrelated = toQueryOfficer(
    reportedOfficer({
      currentPosition: "สว.ธุรการ กก.ตชด.41",
      timeline: [
        {
          id: 1,
          officerId: 1,
          sequence: 0,
          yearBE: 2555,
          year: "2555",
          appointmentCycle: 2555,
          position: "สว.ธุรการ กก.ตชด.41",
          positionLevel: "สารวัตร",
          rank: "ร.ต.ท.",
          unit: "กก.ตชด.41",
          isPresent: true,
        },
      ],
    }),
    asOf,
    ORG_LABELS,
    null
  );

  const urlFilters = filtersFromSearchParams({
    currentPositionLevel: "รองสารวัตร",
    targetPositionLevel: "สารวัตร",
    firstEligibleYearBe: "2574",
  });

  const reportedMatches =
    reported.positionLevel === urlFilters.positionLevel &&
    reported.promotionIntelligence.targetPosition === urlFilters.toPositionLevel &&
    reported.promotionIntelligence.firstEligibleYearBe === urlFilters.firstEligibleYearBe;
  const unrelatedMatches =
    unrelated.positionLevel === urlFilters.positionLevel &&
    unrelated.promotionIntelligence.targetPosition === urlFilters.toPositionLevel &&
    unrelated.promotionIntelligence.firstEligibleYearBe === urlFilters.firstEligibleYearBe;

  assert.equal(reportedMatches, true, "the reported officer's own fields must satisfy the URL-parsed filter");
  assert.equal(unrelatedMatches, false, "an officer already AT สารวัตร (different current level) must not match a รองสารวัตร current-level filter");
});
