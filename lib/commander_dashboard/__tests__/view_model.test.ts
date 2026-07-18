/**
 * Phase 42 — Commander Dashboard Intelligence view model tests.
 *
 * All tests use a fixed, explicit `asOf` — never the real current date —
 * so results are deterministic regardless of when the suite runs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import {
  composeCommanderDashboardViewModel,
  computeBirthdayIntelligence,
  computeRetirementAwareness,
  countPromotionStatuses,
  buildPromotionPriorityCandidates,
  buildActionCenter,
  type DashboardSourceOfficer,
} from "@/lib/commander_dashboard/view_model";
import type { TrainingSummary } from "@/lib/intelligence/training/types";

function noDataTrainingSummary(): TrainingSummary {
  return {
    available: true,
    asOfDate: "2026-07-17",
    totalRecords: 0,
    verifiedRecords: 0,
    unverifiedRecords: 0,
    completedCourseCount: 0,
    missingRequiredCourseCount: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    requiredRequirements: [],
    completedCourses: [],
    missingRequirements: [],
    expiringSoon: [],
    expired: [],
    trainingStatus: "NoData",
    displayStatusTh: "ยังไม่มีข้อมูลการฝึกอบรม",
    recommendationsTh: [],
    dataQualityFlags: [],
  };
}

function officer(overrides: Partial<DashboardSourceOfficer> = {}): DashboardSourceOfficer {
  return {
    officerId: "OFF-1",
    displayName: "ทดสอบ ระบบ",
    rank: "ร.ต.อ.",
    currentPosition: "รอง สว.",
    currentUnit: "กก.1",
    thumbnailUrl: null,
    officialPortraitUrl: null,
    dateOfBirth: null,
    promotionStatus: "Unknown",
    displayStatusTh: "ไม่สามารถประเมินได้",
    displayEligibleSinceTh: null,
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    overdueYears: null,
    promotionCyclesPassed: null,
    priority: null,
    priorityReason: null,
    displayServiceDurationTh: null,
    retirementYearBe: null,
    targetPosition: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
    training: noDataTrainingSummary(),
    ...overrides,
  };
}

const ASOF = utcDate(2026, 7, 17); // 17 July 2026.

// ---------------------------------------------------------------------------
// 1. EligibleThisYear count
// ---------------------------------------------------------------------------
test("EligibleThisYear count reflects only officers with that status", () => {
  const officers = [
    officer({ officerId: "A", promotionStatus: "EligibleThisYear" }),
    officer({ officerId: "B", promotionStatus: "EligibleThisYear" }),
    officer({ officerId: "C", promotionStatus: "Waiting" }),
  ];
  const counts = countPromotionStatuses(officers);
  assert.equal(counts.EligibleThisYear, 2);
  assert.equal(counts.Waiting, 1);
});

// ---------------------------------------------------------------------------
// 2. AlreadyEligible count
// ---------------------------------------------------------------------------
test("AlreadyEligible count is separated from EligibleThisYear", () => {
  const officers = [
    officer({ officerId: "A", promotionStatus: "AlreadyEligible" }),
    officer({ officerId: "B", promotionStatus: "EligibleThisYear" }),
  ];
  const counts = countPromotionStatuses(officers);
  assert.equal(counts.AlreadyEligible, 1);
  assert.equal(counts.EligibleThisYear, 1);
});

// ---------------------------------------------------------------------------
// 3. Unknown promotion data
// ---------------------------------------------------------------------------
test("Unknown promotion data is counted truthfully, never silently folded into another bucket", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "Unknown" })];
  const counts = countPromotionStatuses(officers);
  assert.equal(counts.Unknown, 1);
  assert.equal(counts.EligibleThisYear, 0);
});

test("Unknown-status officers are excluded from the priority candidate list even if priority were somehow set", () => {
  // Per PromotionSummary's contract, priority is null when status is Unknown —
  // this test verifies the list-builder honors null exclusion regardless.
  const officers = [officer({ officerId: "A", promotionStatus: "Unknown", priority: null })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates.length, 0);
});

// ---------------------------------------------------------------------------
// 4. Priority sorting
// ---------------------------------------------------------------------------
test("priority candidates are sorted highest priority first", () => {
  const officers = [
    officer({ officerId: "LOW", promotionStatus: "AlreadyEligible", priority: 30 }),
    officer({ officerId: "HIGH", promotionStatus: "AlreadyEligible", priority: 90 }),
    officer({ officerId: "MID", promotionStatus: "AlreadyEligible", priority: 60 }),
  ];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.deepEqual(candidates.map((c) => c.officerId), ["HIGH", "MID", "LOW"]);
});

test("priority list respects an explicit limit (Top N preview)", () => {
  const officers = Array.from({ length: 15 }, (_, i) =>
    officer({ officerId: `OFF-${i}`, promotionStatus: "AlreadyEligible", priority: i })
  );
  const candidates = buildPromotionPriorityCandidates(officers, 5);
  assert.equal(candidates.length, 5);
  assert.equal(candidates[0].officerId, "OFF-14");
});

// ---------------------------------------------------------------------------
// 5. Birthday today
// ---------------------------------------------------------------------------
test("birthday today is included in the today list with 0 days until birthday", () => {
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1990, 7, 17) })];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.todayCount, 1);
  assert.equal(result.today[0].daysUntilBirthday, 0);
  assert.equal(result.today[0].displayTurningAgeTh, "ครบ 36 ปี วันนี้");
});

// ---------------------------------------------------------------------------
// 6. Birthday within seven days
// ---------------------------------------------------------------------------
test("birthday within seven days is included, sorted soonest first", () => {
  const officers = [
    officer({ officerId: "FAR", dateOfBirth: utcDate(1990, 7, 22) }), // 5 days
    officer({ officerId: "NEAR", dateOfBirth: utcDate(1990, 7, 18) }), // 1 day
  ];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.nextSevenDaysCount, 2);
  assert.deepEqual(result.nextSevenDays.map((o) => o.officerId), ["NEAR", "FAR"]);
  assert.equal(result.nextSevenDays[0].displayTurningAgeTh, "ครบ 36 ปี ในอีก 1 วัน");
});

test("birthday eight days away is excluded from the seven-day window", () => {
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1990, 7, 25) })]; // 8 days away
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.nextSevenDaysCount, 0);
});

// ---------------------------------------------------------------------------
// Phase 43 Workstream C: Birthday Intelligence must render the canonically-
// resolved Official Portrait, never the raw/deprecated thumbnailUrl field —
// this was the exact bug found in the Phase 43 portrait audit
// (lib/commander_dashboard/view_model.ts's toBirthdayViewModel).
// ---------------------------------------------------------------------------
test("Birthday Intelligence profileImageUrl uses officialPortraitUrl, not the raw/deprecated thumbnailUrl", () => {
  const officers = [
    officer({
      officerId: "A",
      dateOfBirth: utcDate(1990, 7, 17),
      thumbnailUrl: "https://unreliable-legacy-url.example/raw.jpg",
      officialPortraitUrl: "https://resolved-official-portrait.example/real.jpg",
    }),
  ];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.today[0].profileImageUrl, "https://resolved-official-portrait.example/real.jpg");
});

test("Birthday Intelligence profileImageUrl is null (placeholder) when no Official Portrait is resolved, even if a raw thumbnailUrl exists", () => {
  const officers = [
    officer({
      officerId: "A",
      dateOfBirth: utcDate(1990, 7, 17),
      thumbnailUrl: "https://unreliable-legacy-url.example/raw.jpg",
      officialPortraitUrl: null,
    }),
  ];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.today[0].profileImageUrl, null);
});

// ---------------------------------------------------------------------------
// 7. Birthday this month
// ---------------------------------------------------------------------------
test("birthday this month includes today, upcoming, and already-passed entries in the required sort order", () => {
  const officers = [
    officer({ officerId: "PASSED", dateOfBirth: utcDate(1990, 7, 5) }), // passed this month
    officer({ officerId: "TODAY", dateOfBirth: utcDate(1990, 7, 17) }),
    officer({ officerId: "UPCOMING", dateOfBirth: utcDate(1990, 7, 28) }),
  ];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.thisMonthCount, 3);
  // Required order: today first, then upcoming, then already-passed.
  assert.deepEqual(result.thisMonth.map((o) => o.officerId), ["TODAY", "UPCOMING", "PASSED"]);
});

test("birthday in a different month is excluded from this-month list", () => {
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1990, 8, 1) })];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.thisMonthCount, 0);
});

// ---------------------------------------------------------------------------
// 8. Birthday year rollover
// ---------------------------------------------------------------------------
test("birthday year rollover: a birthday earlier in the year (already passed) computes next occurrence next year", () => {
  // asOf is 17 July 2026; birthday 1 January -> next occurrence is 1 Jan 2027, not this year.
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1990, 1, 1) })];
  const result = computeBirthdayIntelligence(officers, ASOF);
  assert.equal(result.todayCount, 0);
  assert.equal(result.nextSevenDaysCount, 0);
  // Not in "this month" either (January != July).
  assert.equal(result.thisMonthCount, 0);
});

test("birthday year rollover at 31 December: next occurrence correctly lands in the following January when just passed", () => {
  const decemberAsOf = utcDate(2026, 12, 31);
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1990, 1, 5) })];
  const result = computeBirthdayIntelligence(officers, decemberAsOf);
  assert.equal(result.nextSevenDaysCount, 1);
  assert.equal(result.nextSevenDays[0].daysUntilBirthday, 5);
});

// ---------------------------------------------------------------------------
// 9. Leap-day birthday behavior
// ---------------------------------------------------------------------------
test("leap-day birthday (29 Feb) does not crash and produces a consistent next-birthday date in a non-leap year", () => {
  const nearLeapAsOf = utcDate(2026, 2, 20); // 2026 is not a leap year.
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(2000, 2, 29) })];
  const result = computeBirthdayIntelligence(officers, nearLeapAsOf);
  assert.equal(result.thisMonthCount, 1);
  // addYears clamps 29 Feb -> 28 Feb in a non-leap target year (lib/personnel_calendar's documented behavior).
  assert.equal(result.thisMonth[0].birthdayDateThisYear, "2026-02-28");
});

// ---------------------------------------------------------------------------
// 10. Retirement within one year
// ---------------------------------------------------------------------------
test("retirement within one year is counted and cumulative into the three/five-year bands", () => {
  // Officer turns 60 (retires) very soon relative to asOf.
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1966, 8, 1) })]; // ~60 in Aug 2026, retires FY2027.
  const result = computeRetirementAwareness(officers, ASOF);
  assert.ok(result.withinOneYear >= 1, "should count toward within-one-year");
  assert.ok(result.withinThreeYears >= result.withinOneYear, "three-year band is cumulative");
  assert.ok(result.withinFiveYears >= result.withinThreeYears, "five-year band is cumulative");
});

// ---------------------------------------------------------------------------
// 11. Retirement within three years
// ---------------------------------------------------------------------------
test("retirement within three years excludes an officer retiring far beyond the horizon", () => {
  const officers = [
    officer({ officerId: "SOON", dateOfBirth: utcDate(1968, 1, 1) }), // retires within a few years
    officer({ officerId: "FAR", dateOfBirth: utcDate(1995, 1, 1) }), // decades away
  ];
  const result = computeRetirementAwareness(officers, ASOF, 5);
  const ids = result.candidates.map((c) => c.officerId);
  assert.ok(!ids.includes("FAR"), "an officer far beyond the horizon must not appear in candidates");
});

// ---------------------------------------------------------------------------
// 12. No fabricated zero for unavailable data
// ---------------------------------------------------------------------------
test("officer with no dateOfBirth is excluded from birthday/retirement lists, not silently counted as zero", () => {
  const officers = [officer({ officerId: "A", dateOfBirth: null })];
  const birthdays = computeBirthdayIntelligence(officers, ASOF);
  const retirement = computeRetirementAwareness(officers, ASOF);
  assert.equal(birthdays.todayCount, 0);
  assert.equal(birthdays.thisMonthCount, 0);
  assert.equal(retirement.candidates.length, 0);

  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.personnelOverview.dataUnavailableCount, 1, "must explicitly report the unavailable officer, not hide it in a zero count");
  assert.equal(viewModel.personnelOverview.totalPersonnel, 1);
});

// ---------------------------------------------------------------------------
// 13. Thai/Buddhist Era display
// ---------------------------------------------------------------------------
test("dashboard view model exposes Buddhist-Era fiscal year and Thai display text, never a raw Gregorian year", () => {
  const viewModel = composeCommanderDashboardViewModel([], ASOF);
  assert.equal(viewModel.fiscalYearBe, 2569);
  assert.equal(viewModel.displayFiscalYearTh, "ปีงบประมาณ 2569");
});

test("retirement candidate display fields use Thai/Buddhist-Era text, not raw Gregorian dates", () => {
  const officers = [officer({ officerId: "A", dateOfBirth: utcDate(1966, 8, 1) })];
  const result = computeRetirementAwareness(officers, ASOF);
  assert.equal(result.candidates.length, 1);
  assert.ok(result.candidates[0].displayRetirementYearTh.startsWith("ปีงบประมาณ"));
  assert.ok(!result.candidates[0].displayRetirementDateTh.match(/^\d{4}-\d{2}-\d{2}$/), "must not be a raw ISO date");
});

// ---------------------------------------------------------------------------
// 14. Empty dataset
// ---------------------------------------------------------------------------
test("empty dataset produces a valid view model with all-zero counts, no crash", () => {
  const viewModel = composeCommanderDashboardViewModel([], ASOF);
  assert.equal(viewModel.personnelOverview.totalPersonnel, 0);
  assert.equal(viewModel.promotion.eligibleThisYear, 0);
  assert.equal(viewModel.birthdays.todayCount, 0);
  assert.equal(viewModel.retirement.withinOneYear, 0);
  assert.deepEqual(viewModel.actionCenter, []);
  assert.deepEqual(viewModel.promotion.priorityCandidates, []);
});

// ---------------------------------------------------------------------------
// 15. Drill-down filter generation
// ---------------------------------------------------------------------------
test("action center items carry a href with an explicit, shareable query-string filter", () => {
  const items = buildActionCenter({
    eligibleThisYearHighPriorityCount: 3,
    retirementWithinOneYearCount: 2,
    unknownPromotionCount: 1,
    birthdayTodayCount: 4,
  });
  const promotionItem = items.find((i) => i.category === "PROMOTION_PRIORITY");
  const retirementItem = items.find((i) => i.category === "RETIREMENT");
  const dataQualityItem = items.find((i) => i.category === "DATA_QUALITY");
  assert.equal(promotionItem?.href, "/commander-search?promotionEligibilityStatus=AlreadyEligible");
  assert.equal(retirementItem?.href, "/commander-search?retirement=within-1-year");
  assert.equal(dataQualityItem?.href, "/commander-search?promotionEligibilityStatus=Unknown");
});

test("action center omits zero-count categories entirely", () => {
  const items = buildActionCenter({
    eligibleThisYearHighPriorityCount: 0,
    retirementWithinOneYearCount: 0,
    unknownPromotionCount: 0,
    birthdayTodayCount: 0,
  });
  assert.deepEqual(items, []);
});

test("birthday action center items are always info severity, never inflated to high/medium", () => {
  const items = buildActionCenter({
    eligibleThisYearHighPriorityCount: 0,
    retirementWithinOneYearCount: 0,
    unknownPromotionCount: 0,
    birthdayTodayCount: 5,
  });
  const birthdayItem = items.find((i) => i.category === "BIRTHDAY");
  assert.equal(birthdayItem?.severity, "info");
});

// ---------------------------------------------------------------------------
// Additional coverage: promotion candidate display fields never show decimal years
// ---------------------------------------------------------------------------
test("promotion priority candidate exact eligible duration never contains a decimal point", () => {
  const officers = [
    officer({
      officerId: "A",
      promotionStatus: "AlreadyEligible",
      priority: 75,
      yearsEligible: 3,
      monthsEligible: 4,
      daysEligible: 12,
    }),
  ];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayEligibleDurationTh, "3 ปี 4 เดือน 12 วัน");
  assert.ok(!candidates[0].displayEligibleDurationTh?.includes("."));
});

// ---------------------------------------------------------------------------
// Phase 42 UI refinement — presentation-only additions
// ---------------------------------------------------------------------------

test("first eligible cycle date is 1 October of the first eligible fiscal year, never January or an arbitrary date", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, eligibleFiscalYearBe: 2568 })];
  const candidates = buildPromotionPriorityCandidates(officers);
  // Fiscal year 2568 BE -> Gregorian 2568-543=2025 -> fiscalYearStart(2025) = 1 Oct 2024.
  assert.equal(candidates[0].displayEligibleFirstCycleTh, "1 ต.ค. 2567");
  assert.equal(candidates[0].displayEligibleFiscalYearTh, "(ปีงบประมาณ 2568)");
});

test("first eligible cycle date is null when eligibleFiscalYearBe is unavailable", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "Waiting", priority: 10, eligibleFiscalYearBe: null })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayEligibleFirstCycleTh, null);
  assert.equal(candidates[0].displayEligibleFiscalYearTh, null);
});

test("promotion year ordinal ('ปีนี้เป็นปีที่ N') is sourced directly from overdueYears, never recalculated", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, overdueYears: 2 })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].promotionYearOrdinal, 2);
});

test("promotion year ordinal is null when the officer is not yet eligible (overdueYears is 0)", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "Waiting", priority: 10, overdueYears: 0 })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].promotionYearOrdinal, null);
});

test("promotion cycle label is compact ('รอบที่ N'), not the verbose sentence form", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, promotionCyclesPassed: 3 })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayPromotionCycleTh, "รอบที่ 3");
});

test("service years and retirement year are passed through from Service/Retirement Intelligence, never recalculated", () => {
  const officers = [
    officer({
      officerId: "A",
      promotionStatus: "AlreadyEligible",
      priority: 75,
      displayServiceDurationTh: "16 ปี 1 เดือน 3 วัน",
      retirementYearBe: 2588,
    }),
  ];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayServiceDurationTh, "16 ปี 1 เดือน 3 วัน");
  assert.ok(!candidates[0].displayServiceDurationTh?.includes("."), "service duration must never be decimal");
  assert.equal(candidates[0].retirementYearBe, 2588);
  assert.equal(candidates[0].displayRetirementYearTh, "พ.ศ. 2588");
});

test("official portrait URL is passed through distinctly from the legacy thumbnail field", () => {
  const officers = [
    officer({
      officerId: "A",
      promotionStatus: "AlreadyEligible",
      priority: 75,
      thumbnailUrl: "https://example.com/gallery-thumb.jpg",
      officialPortraitUrl: "https://example.com/official-portrait.jpg",
    }),
  ];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].officialPortraitUrl, "https://example.com/official-portrait.jpg");
});

test("official portrait URL is null (graceful fallback) when no trusted portrait exists", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, officialPortraitUrl: null })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].officialPortraitUrl, null);
});

test("priority and priorityReason remain on the view model for backward compatibility even though the table no longer renders them", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, priorityReason: "Overdue 2 years" })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].priority, 75);
  assert.equal(candidates[0].priorityReason, "Overdue 2 years");
});

// ---------------------------------------------------------------------------
// Commander Promotion UX refinement — "คุณสมบัติ" and "ดำรงตำแหน่งระดับนี้มา"
// ---------------------------------------------------------------------------

test("target-qualification label answers 'ครบขึ้นตำแหน่งอะไร', sourced directly from PromotionSummary.targetPosition", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, targetPosition: "ผกก." })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayTargetQualificationTh, "ครบขึ้น ผกก.");
});

test("target-qualification label is null when targetPosition is unavailable", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "Waiting", priority: 10, targetPosition: null })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayTargetQualificationTh, null);
});

test("'ดำรงตำแหน่งระดับนี้มา' shows the commander-facing YEAR COUNT at the CURRENT position level, not a promotion-cycle count", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, positionLevelYearCount: 5 })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayYearsAtLevelTh, "5 ปี");
});

test("'ดำรงตำแหน่งระดับนี้มา' never shows a decimal — positionLevelYearCount is already a whole-number year count", () => {
  const officers = [officer({ officerId: "A", promotionStatus: "AlreadyEligible", priority: 75, positionLevelYearCount: 5 })];
  const candidates = buildPromotionPriorityCandidates(officers);
  assert.equal(candidates[0].displayYearsAtLevelTh, "5 ปี");
  assert.ok(!candidates[0].displayYearsAtLevelTh?.includes("."));
});

// ---------------------------------------------------------------------------
// Phase 45 — Training Intelligence Dashboard integration.
// ---------------------------------------------------------------------------

test("20. Dashboard training.missingRequiredCount is confirmed zero (never fabricated) when no officer has MissingRequired status", () => {
  const officers = [officer({ training: noDataTrainingSummary() })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.missingRequiredCount, 0);
});

test("NoPolicy officers are counted separately from MissingRequired — never conflated", () => {
  const noPolicySummary = { ...noDataTrainingSummary(), trainingStatus: "NoPolicy" as const, totalRecords: 3 };
  const officers = [officer({ training: noPolicySummary }), officer({ officerId: "B", training: noPolicySummary })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.noPolicyCount, 2);
  assert.equal(viewModel.training.missingRequiredCount, 0);
});

test("training.policyConfigured is false when no officer's target level has a real TrainingPolicy (true for every officer today)", () => {
  const officers = [officer({ targetPosition: "รองผู้กำกับการ" })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.policyConfigured, false);
});

test("Action Center's NoPolicy training item (Phase 45 completion pass, Task 7C) is informational only — never actionable/urgent, never the MissingRequired/Expired id", () => {
  const officers = [officer({ training: { ...noDataTrainingSummary(), trainingStatus: "NoPolicy" } })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  const trainingItems = viewModel.actionCenter.filter((item) => item.category === "TRAINING");
  assert.ok(trainingItems.length > 0, "a NoPolicy item should exist so a commander understands why training evaluation is unavailable");
  for (const item of trainingItems) {
    assert.equal(item.severity, "info", "NoPolicy must never be presented with medium/high severity");
    assert.notEqual(item.id, "training-missing-required");
    assert.notEqual(item.id, "training-expired");
  }
});

test("Action Center's NoPolicy training item never carries a drill-down href (there is nothing real to filter to)", () => {
  const officers = [officer({ training: { ...noDataTrainingSummary(), trainingStatus: "NoPolicy" } })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  const noPolicyItem = viewModel.actionCenter.find((item) => item.id === "training-no-policy");
  assert.ok(noPolicyItem);
  assert.equal(noPolicyItem!.href, null);
});

test("Action Center DOES surface a real MissingRequired training item (never a NoPolicy misread) when the count is genuinely positive", () => {
  const missingSummary = { ...noDataTrainingSummary(), trainingStatus: "MissingRequired" as const, missingRequiredCourseCount: 1 };
  const officers = [officer({ training: missingSummary })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  const trainingItem = viewModel.actionCenter.find((item) => item.category === "TRAINING");
  assert.ok(trainingItem);
  assert.equal(trainingItem!.id, "training-missing-required");
});

// ---------------------------------------------------------------------------
// Phase 45 completion pass — Dashboard KPI/Overview/Priority visibility
// (Task 14 items 11-13, 20-22).
// ---------------------------------------------------------------------------

test("11. Dashboard NoPolicy: policyConfigured is false and every officer reports NoPolicy/NoData, never MissingRequired", () => {
  const officers = [officer({ targetPosition: "รองผู้กำกับการ", training: { ...noDataTrainingSummary(), trainingStatus: "NoPolicy" } })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.policyConfigured, false);
  assert.equal(viewModel.training.missingRequiredCount, 0);
  assert.equal(viewModel.training.noPolicyCount, 1);
});

test("12. Dashboard confirmed zero under a real policy state: missingRequiredCount is exactly 0 (not fabricated) and distinct from noPolicyCount", () => {
  const officers = [officer({ training: { ...noDataTrainingSummary(), trainingStatus: "Complete" } })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.missingRequiredCount, 0);
  assert.equal(viewModel.training.noPolicyCount, 0, "a Complete officer must never be counted as NoPolicy");
});

test("13. Dashboard real missing-training count is a genuine positive tally, never conflated with NoPolicy/NoData counts", () => {
  const officers = [
    officer({ officerId: "A", training: { ...noDataTrainingSummary(), trainingStatus: "MissingRequired", missingRequiredCourseCount: 1 } }),
    officer({ officerId: "B", training: { ...noDataTrainingSummary(), trainingStatus: "NoPolicy" } }),
  ];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.missingRequiredCount, 1);
  assert.equal(viewModel.training.noPolicyCount, 1);
});

test("training.unavailableCount is 0 (never fabricated) and only counts officers whose TrainingSummary.available is false", () => {
  const officers = [officer({ training: noDataTrainingSummary() })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.unavailableCount, 0);
});

test("20. Training Priority panel data: priorityOfficers is empty when no officer matches any priority tier", () => {
  const officers = [officer({ training: { ...noDataTrainingSummary(), trainingStatus: "Complete" } })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.deepEqual(viewModel.training.priorityOfficers, []);
});

test("21. Training Priority panel data: a real MissingRequired + promotion-eligible officer produces a priority record", () => {
  const officers = [
    officer({
      officerId: "PRIORITY-1",
      displayName: "ทดสอบ เร่งด่วน",
      promotionStatus: "AlreadyEligible",
      training: { ...noDataTrainingSummary(), trainingStatus: "MissingRequired", missingRequiredCourseCount: 1 },
    }),
  ];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.priorityOfficers.length, 1);
  assert.equal(viewModel.training.priorityOfficers[0].officerId, "PRIORITY-1");
});

test("22. Training Priority record uses the officer's officialPortraitUrl (the canonical resolver field), never a raw/gallery field", () => {
  const officers = [
    officer({
      officerId: "PRIORITY-2",
      officialPortraitUrl: "https://resolved.example/official.jpg",
      promotionStatus: "EligibleThisYear",
      training: { ...noDataTrainingSummary(), trainingStatus: "Expired", expiredCount: 1 },
    }),
  ];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.priorityOfficers[0].officialPortraitUrl, "https://resolved.example/official.jpg");
});

test("Training Priority never creates a record from NoPolicy alone", () => {
  const officers = [officer({ training: { ...noDataTrainingSummary(), trainingStatus: "NoPolicy" } })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.deepEqual(viewModel.training.priorityOfficers, []);
});

test("26. no fabricated policy — composeCommanderDashboardViewModel never invents a TrainingPolicy; policyConfigured stays false with real, unconfigured production policy data", () => {
  const officers = [officer({ targetPosition: "ผู้กำกับการ" })];
  const viewModel = composeCommanderDashboardViewModel(officers, ASOF);
  assert.equal(viewModel.training.policyConfigured, false);
});
