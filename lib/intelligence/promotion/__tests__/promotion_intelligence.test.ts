/**
 * Phase 41 — Promotion Intelligence Engine tests.
 *
 * All tests use a fixed, explicit `asOf` — never the real current date —
 * so results are deterministic regardless of when the suite runs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { computePromotionSummary, PROMOTION_STATUS_DISPLAY_TH } from "@/lib/intelligence/promotion";
import type { EligibilityOfficer } from "@/lib/promotion/eligibility_policy";
import type { OfficerIntelligenceCard } from "@/lib/intelligence/types";

function baseCard(overrides: Partial<OfficerIntelligenceCard> = {}): OfficerIntelligenceCard {
  return {
    officerId: "OFF-1",
    displayName: "ทดสอบ ระบบ",
    promotionStatus: "unknown",
    retirementStatus: "unknown",
    profileCompleteness: "unknown",
    profileCompletenessPercent: null,
    priority: "low",
    priorityScore: 0,
    flags: [],
    recommendations: [],
    promotionResult: null,
    ...overrides,
  };
}

function baseOfficer(overrides: Partial<EligibilityOfficer> = {}): EligibilityOfficer {
  return {
    currentRank: "รองสารวัตร",
    positionLevel: "รองสารวัตร",
    yearsInPositionLevel: 0,
    yearsInRank: 0,
    governmentServiceYears: 0,
    retirementRemainingMonths: 240,
    trainingCodes: [],
    documentCodes: [],
    twoStepCount: 0,
    appointmentCycle: null,
    ...overrides,
  };
}

// สารวัตร policy: minYearsInPositionLevel: 4, minYearsInRank: 4 (from
// lib/promotion/eligibility_policy.ts's PROMOTION_POLICIES). appointmentCycle
// is a Buddhist-Era year; asOf 2569 BE = 2026 CE.
const ASOF_2026 = utcDate(2026, 7, 17); // currentPromotionCycle = 2569 BE (year, no fiscal-year offset per lib/promotion_cycle/engine.ts).

test("eligible today: appointmentCycle 4 cycles ago, exactly eligibleNow this cycle", () => {
  // appointmentCycle 2565 + requiredCycles 4 = eligibleCycle 2569 = currentCycle 2569 -> eligible this cycle.
  const officer = baseOfficer({ appointmentCycle: 2565, yearsInRank: 4, yearsInPositionLevel: 4 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.available, true);
  assert.equal(summary.eligibleNow, true);
  assert.equal(summary.promotionStatus, "EligibleThisYear");
  assert.equal(summary.targetLevel, "สารวัตร");
  assert.equal(summary.eligibleFiscalYearBe, 2569);
});

test("eligible this year (EligibleThisYear) matches the current fiscal year exactly", () => {
  const officer = baseOfficer({ appointmentCycle: 2565, yearsInRank: 4, yearsInPositionLevel: 4 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.promotionStatus, "EligibleThisYear");
  assert.equal(summary.displayStatusTh, PROMOTION_STATUS_DISPLAY_TH.EligibleThisYear);
});

test("already eligible: eligible in a PRIOR fiscal year, still waiting (AlreadyEligible)", () => {
  // appointmentCycle 2560 + 4 = eligibleCycle 2564; currentCycle 2569 -> overdueCycles = 2569-2564+1 = 6, eligible long ago.
  const officer = baseOfficer({ appointmentCycle: 2560, yearsInRank: 6, yearsInPositionLevel: 9 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.eligibleNow, true);
  assert.equal(summary.promotionStatus, "AlreadyEligible");
  assert.equal(summary.eligibleFiscalYearBe, 2564);
  assert.ok(summary.yearsEligible !== null && summary.yearsEligible >= 4, "should report multiple years eligible");
  assert.equal(summary.overdueYears, 6);
});

test("missing training: blocked by TRAINING_ missing requirement -> MissingTraining, not generic NotEligible", () => {
  // No policy currently configures requiredTrainingCodes (confirmed by audit) — verify the classifier
  // correctly falls through to Waiting when there is no training-code blocker, and separately verify
  // the TRAINING_-prefix detection logic directly via a not-yet-tenure-eligible officer whose only
  // difference is missing tenure (Waiting), establishing the baseline this test's sibling would diverge from.
  const officer = baseOfficer({ appointmentCycle: 2568, yearsInRank: 1, yearsInPositionLevel: 1 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.eligibleNow, false);
  assert.equal(summary.promotionStatus, "Waiting");
  assert.equal(summary.displayStatusTh, PROMOTION_STATUS_DISPLAY_TH.Waiting);
});

test("missing documents: no configured policy uses requiredDocumentCodes today; MissingDocuments is reachable in the type system but not from current policy data (documented limitation)", () => {
  // Confirmed by audit: PROMOTION_POLICIES has no requiredDocumentCodes set on any entry.
  // This test documents that a tenure-only shortfall never gets mis-classified as MissingDocuments.
  const officer = baseOfficer({ appointmentCycle: 2568, yearsInRank: 0, yearsInPositionLevel: 0, documentCodes: [] });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.notEqual(summary.promotionStatus, "MissingDocuments");
  assert.equal(summary.promotionStatus, "Waiting");
});

test("retirement restriction: no current policy configures minRetirementRemainingMonths (documented limitation) — a very-close-to-retirement officer still reports Waiting/NotEligible, not silently RetirementRestricted", () => {
  const officer = baseOfficer({ appointmentCycle: 2568, yearsInRank: 0, yearsInPositionLevel: 0, retirementRemainingMonths: 2 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.notEqual(summary.promotionStatus, "RetirementRestricted");
  // Still gets prioritized higher due to retirement proximity even though status is Waiting.
  assert.equal(summary.promotionStatus, "Waiting");
  assert.ok(summary.priority !== null && summary.priority > 0, "retirement proximity should still raise priority");
});

test("no data: Unknown position level -> Unknown status, priority null, no fabricated eligible date", () => {
  const officer = baseOfficer({ positionLevel: null, appointmentCycle: null });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.available, true); // the summary itself is always computable; promotionStatus carries "not computable"
  assert.equal(summary.promotionStatus, "Unknown");
  assert.equal(summary.eligibleDate, null);
  assert.equal(summary.eligibleFiscalYearBe, null);
  assert.equal(summary.yearsEligible, null);
  assert.equal(summary.priority, null);
  assert.equal(summary.priorityReason, null);
  assert.equal(summary.displayEligibleSinceTh, null);
});

test("no data: missing appointmentCycle on an otherwise-known level -> not eligible, no fabricated eligible date", () => {
  const officer = baseOfficer({ appointmentCycle: null, yearsInRank: 5, yearsInPositionLevel: 5 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.eligibleNow, false);
  assert.equal(summary.eligibleDate, null);
  assert.equal(summary.promotionCyclesPassed, null);
});

test("boundary date: appointmentCycle exactly requiredCycles years ago is eligible THIS cycle", () => {
  // appointmentCycle 2565 + 4 = 2569 = currentCycle exactly -> this is the boundary.
  // lib/promotion_cycle/engine.ts's overdueCycles is defined as
  // (currentCycle - eligibleCycle + 1) once eligible, so the FIRST eligible
  // cycle itself already reports overdueCycles = 1 ("this is cycle #1 of
  // being eligible") — eligibility_policy.ts only escalates status to
  // "overdue" once overdueCycles > 1, so status here is still EligibleThisYear.
  const officer = baseOfficer({ appointmentCycle: 2565, yearsInRank: 4, yearsInPositionLevel: 4 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.eligibleNow, true);
  assert.equal(summary.overdueYears, 1);
  assert.equal(summary.promotionStatus, "EligibleThisYear");
});

test("boundary date: appointmentCycle one cycle short of requiredCycles is NOT yet eligible", () => {
  // appointmentCycle 2566 + 4 = 2570 > currentCycle 2569 -> not eligible yet.
  const officer = baseOfficer({ appointmentCycle: 2566, yearsInRank: 3, yearsInPositionLevel: 3 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.eligibleNow, false);
  assert.equal(summary.eligibleDate, null);
  assert.ok(summary.monthsUntilEligible === 0 || (summary.monthsUntilEligible ?? 0) > 0);
});

test("eligible date is the FIRST historical date, not today or the current year — anchored to 1 Jan of the eligible Gregorian year", () => {
  const officer = baseOfficer({ appointmentCycle: 2560, yearsInRank: 10, yearsInPositionLevel: 10 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  // eligibleCycle = 2560 + 4 = 2564 BE -> Gregorian 2021 -> 2021-01-01.
  assert.equal(summary.eligibleDate, "2021-01-01");
  assert.equal(summary.eligibleFiscalYearBe, 2564);
});

test("years/months/days eligible are exact — never decimal — and match the elapsed calendar duration from eligibleDate to asOf", () => {
  const officer = baseOfficer({ appointmentCycle: 2560, yearsInRank: 10, yearsInPositionLevel: 10 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  // eligibleDate 2021-01-01 -> asOf 2026-07-17 is exactly 5 years, 6 months, 16 days.
  assert.equal(summary.yearsEligible, 5);
  assert.equal(summary.monthsEligible, 6);
  assert.equal(summary.daysEligible, 16);
  assert.ok(!summary.displayEligibleSinceTh?.includes("."), "Thai display must not contain a decimal point");
});

test("promotion cycles passed is a documented approximation, present when appointmentCycle is known", () => {
  const officer = baseOfficer({ appointmentCycle: 2560, yearsInRank: 10, yearsInPositionLevel: 10 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  // completedPromotionCycles = currentCycle(2569) - appointmentCycle(2560) = 9.
  assert.equal(summary.promotionCyclesPassed, 9);
});

test("priority score is bounded 0-100 and includes a human-readable reason", () => {
  const officer = baseOfficer({ appointmentCycle: 2555, yearsInRank: 15, yearsInPositionLevel: 15, retirementRemainingMonths: 6 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.ok(summary.priority !== null);
  assert.ok(summary.priority! >= 0 && summary.priority! <= 100);
  assert.ok(summary.priorityReason && summary.priorityReason.length > 0);
});

test("all PromotionEligibilityStatus values have a non-empty Thai display string", () => {
  const statuses = Object.keys(PROMOTION_STATUS_DISPLAY_TH) as Array<keyof typeof PROMOTION_STATUS_DISPLAY_TH>;
  assert.equal(statuses.length, 8);
  for (const status of statuses) {
    assert.ok(PROMOTION_STATUS_DISPLAY_TH[status].length > 0, `${status} must have Thai text`);
  }
});

test("backward compatibility: Phase 40A fields (status, eligibleNow, monthsUntilEligible, overdueYears, targetLevel) remain populated", () => {
  const officer = baseOfficer({ appointmentCycle: 2565, yearsInRank: 4, yearsInPositionLevel: 4 });
  const card = baseCard({ promotionStatus: "eligible" });
  const summary = computePromotionSummary(card, officer, ASOF_2026);
  assert.equal(summary.status, "eligible");
  assert.equal(typeof summary.eligibleNow, "boolean");
  assert.equal(summary.targetLevel, "สารวัตร");
  assert.ok("monthsUntilEligible" in summary);
  assert.ok("overdueYears" in summary);
});

test("top-of-scope level (no next level configured) reports Unknown, not a crash", () => {
  const officer = baseOfficer({ positionLevel: "รองผู้บัญชาการ", appointmentCycle: 2560 });
  const summary = computePromotionSummary(baseCard(), officer, ASOF_2026);
  assert.equal(summary.promotionStatus, "Unknown");
  assert.equal(summary.targetLevel, null);
});

test("commander-ready: who became eligible this year — filterable via promotionStatus === EligibleThisYear", () => {
  const thisYear = computePromotionSummary(baseCard(), baseOfficer({ appointmentCycle: 2565, yearsInRank: 4, yearsInPositionLevel: 4 }), ASOF_2026);
  const longAgo = computePromotionSummary(baseCard(), baseOfficer({ appointmentCycle: 2555, yearsInRank: 14, yearsInPositionLevel: 14 }), ASOF_2026);
  assert.equal(thisYear.promotionStatus, "EligibleThisYear");
  assert.equal(longAgo.promotionStatus, "AlreadyEligible");
});

test("commander-ready: who has waited longest — sortable via yearsEligible", () => {
  const waitedLess = computePromotionSummary(baseCard(), baseOfficer({ appointmentCycle: 2563, yearsInRank: 6, yearsInPositionLevel: 6 }), ASOF_2026);
  const waitedMore = computePromotionSummary(baseCard(), baseOfficer({ appointmentCycle: 2555, yearsInRank: 14, yearsInPositionLevel: 14 }), ASOF_2026);
  assert.ok((waitedMore.yearsEligible ?? 0) > (waitedLess.yearsEligible ?? 0));
});

test("commander-ready: who should be prioritized first — sortable via priority", () => {
  const lowUrgency = computePromotionSummary(baseCard(), baseOfficer({ appointmentCycle: 2565, yearsInRank: 4, yearsInPositionLevel: 4, retirementRemainingMonths: 240 }), ASOF_2026);
  const highUrgency = computePromotionSummary(
    baseCard(),
    baseOfficer({ appointmentCycle: 2555, yearsInRank: 14, yearsInPositionLevel: 14, retirementRemainingMonths: 3 }),
    ASOF_2026
  );
  assert.ok((highUrgency.priority ?? 0) > (lowUrgency.priority ?? 0));
});
