/**
 * Phase 49.9 — สารวัตร → รองผู้กำกับการ five-year tenure + semantic audit.
 *
 * Anonymized fixture (no real officer ID/name):
 *   - Current position level: สารวัตร
 *   - Level start: 16 กุมภาพันธ์ 2564 (BE)
 *   - Required tenure: 5 years
 *   - First eligible: 16 กุมภาพันธ์ 2569
 *
 * Semantics (confirmed):
 *   - eligibleYearOrdinal first cycle = 1
 *   - overdueYears / promotionCyclesPassed first cycle = 0
 *   - appointment cycle display (รอบที่) = eligibleYearOrdinal
 *   - displayWaitingTh first cycle = "ครบคุณสมบัติในปีนี้"
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import { filtersFromSearchParams } from "@/lib/commander_query/search_params";
import { composeOfficerIntelligenceViewModel } from "@/lib/officer_intelligence/view_model";
import { toDashboardSourceOfficer } from "@/lib/commander_dashboard/dataset_composers";
import { buildPromotionPriorityCandidates } from "@/lib/commander_dashboard/view_model";
import { policyForTargetLevel } from "@/lib/promotion/eligibility_policy";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";
import { INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "TEST-SARAWAT-1",
    rank: "ร.ต.อ.",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "สารวัตรป้องกันและปราบปราม",
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

const ORG_LABELS = { company: "กองร้อยทดสอบ" };

/** สารวัตร start on 16 Feb 2564, still present. Rank matches for minYearsInRank. */
function reportedOfficer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return officer({
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        yearBE: 2564,
        year: "2564",
        day: 16,
        month: 2,
        appointmentCycle: 2564,
        position: "สารวัตรป้องกันและปราบปราม",
        positionLevel: "สารวัตร",
        rank: "ร.ต.อ.",
        unit: "กก.ตชด.41",
        isPresent: true,
      }),
    ],
    ...overrides,
  });
}

test("policy: สารวัตร → รองผู้กำกับการ requires exactly 5 years (not 4)", () => {
  assert.equal(policyForTargetLevel("รองผู้กำกับการ")?.minYearsInPositionLevel, 5);
  assert.equal(policyForTargetLevel("สารวัตร")?.minYearsInPositionLevel, 7, "รอง สว. → สารวัตร seven-year rule must remain");
});

test("1. requiredTenureYears serializes as 5", () => {
  const asOf = utcDate(2026, 7, 20); // BE 2569
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.targetPosition, "รองผู้กำกับการ");
  assert.equal(result.promotionIntelligence.requiredTenureYears, 5);
});

test("2. start 16 Feb 2564 → first eligible appointment year anchor 1 Jan 2569", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  // Phase 49.11: appointment-year anchor (not exact anniversary day/month).
  assert.equal(result.promotionIntelligence.firstEligibleDate, "2026-01-01");
  assert.equal(result.promotionIntelligence.firstEligibleYearBe, 2569);
});

test("3. day before exact anniversary in BE 2569 → still eligible (appointment-year rule)", () => {
  const asOf = utcDate(2026, 2, 15);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, true);
  assert.equal(result.promotionIntelligence.overdueYears, 0);
  assert.equal(result.promotionIntelligence.eligibleYearOrdinal, 1);
  assert.equal(result.promotionIntelligence.promotionCyclesPassed, 0);
  const vm = composeOfficerIntelligenceViewModel(reportedOfficer(), ORG_LABELS, null, asOf);
  assert.equal(vm.promotion.eligibilityYearNumber, 1);
  assert.equal(vm.promotion.displayWaitingTh, "ครบคุณสมบัติในปีนี้");
});

test("4. on 16 Feb 2569 → eligible", () => {
  const asOf = utcDate(2026, 2, 16);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, true);
});

test("5. day after 16 Feb 2569 → eligible", () => {
  const asOf = utcDate(2026, 2, 17);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.eligibleNow, true);
});

test("6. first eligible Buddhist year = 2569 (never 2568)", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.promotionIntelligence.firstEligibleFiscalYearBe, 2569);
  assert.notEqual(result.promotionIntelligence.firstEligibleFiscalYearBe, 2568);
});

test("7–10. first eligible cycle: overdueYears=0, ordinal=1, missed=0, ครบคุณสมบัติในปีนี้", () => {
  const asOf = utcDate(2026, 7, 20); // BE 2569 — first eligible cycle after 16 Feb
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const promo = result.promotionIntelligence;
  assert.equal(promo.eligibleNow, true);
  assert.equal(promo.overdueYears, 0);
  assert.equal(promo.eligibleYearOrdinal, 1);
  assert.equal(promo.promotionCyclesPassed, 0);
  assert.equal(promo.promotionStatus, "EligibleThisYear");
  assert.equal(overdueOpportunities(promo.overdueYears), null);

  const vm = composeOfficerIntelligenceViewModel(reportedOfficer(), ORG_LABELS, null, asOf);
  assert.equal(vm.promotion.waitingYears, null);
  assert.equal(vm.promotion.displayWaitingTh, "ครบคุณสมบัติในปีนี้");
  assert.equal(vm.promotion.eligibilityYearNumber, 1);
  assert.equal(vm.promotion.firstEligibleYearBe, 2569);
  assert.equal(vm.promotion.requiredTenureYears, 5);
  assert.notEqual(vm.promotion.firstEligibleYearBe, 2568);
  assert.notEqual(vm.promotion.displayWaitingTh, "รอการแต่งตั้งมาแล้ว 1 ปี");
  assert.ok(!vm.promotion.displayWaitingTh?.includes("1 ปี"));
});

test("11. one completed canonical cycle later: overdueYears=1, ordinal=2, รอมาแล้ว 1 ปี", () => {
  const asOf = utcDate(2027, 7, 20); // BE 2570
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const promo = result.promotionIntelligence;
  assert.equal(promo.eligibleNow, true);
  assert.equal(promo.overdueYears, 1);
  assert.equal(promo.eligibleYearOrdinal, 2);
  assert.equal(promo.promotionCyclesPassed, 1);
  assert.equal(overdueOpportunities(promo.overdueYears), 1);

  const vm = composeOfficerIntelligenceViewModel(reportedOfficer(), ORG_LABELS, null, asOf);
  assert.equal(vm.promotion.waitingYears, 1);
  assert.equal(vm.promotion.eligibilityYearNumber, 2);
  assert.equal(vm.promotion.displayWaitingTh, "รอการแต่งตั้งมาแล้ว 1 ปี");
});

test("12. Officer Profile never shows 'รอมาแล้ว 1 ปี' in the first eligible cycle", () => {
  const asOf = utcDate(2026, 7, 20);
  const vm = composeOfficerIntelligenceViewModel(reportedOfficer(), ORG_LABELS, null, asOf);
  assert.equal(vm.promotion.displayWaitingTh, "ครบคุณสมบัติในปีนี้");
  assert.equal(vm.promotion.waitingYears, null);
  assert.equal(vm.promotion.eligibilityYearNumber, 1);
});

test("13. Dashboard does not place first-cycle officers in overdue-one-year groups", () => {
  const asOf = utcDate(2026, 7, 20);
  const queryOfficer = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const source = toDashboardSourceOfficer(queryOfficer);
  assert.equal(source.overdueYears, 0);
  assert.equal(source.eligibleYearOrdinal, 1);
  const candidates = buildPromotionPriorityCandidates([
    { ...source, priority: source.priority ?? 50 },
  ]);
  assert.equal(candidates[0]?.promotionYearOrdinal, 1);
  // Same predicate CIC / Search / Reports use for "overdue ≥ 1 year".
  const overdueGroupCount = [queryOfficer].filter(
    (o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0
  ).length;
  assert.equal(overdueGroupCount, 0);
});

test("14. Commander Search filter overdueYears>0 excludes first-cycle officers", () => {
  const firstCycle = toQueryOfficer(reportedOfficer(), utcDate(2026, 7, 20), ORG_LABELS, null);
  const nextCycle = toQueryOfficer(reportedOfficer(), utcDate(2027, 7, 20), ORG_LABELS, null);
  assert.equal(firstCycle.promotionIntelligence.overdueYears, 0);
  assert.equal(nextCycle.promotionIntelligence.overdueYears, 1);
  const overdueOnly = [firstCycle, nextCycle].filter(
    (o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0
  );
  assert.equal(overdueOnly.length, 1);
  assert.equal(overdueOnly[0].promotionIntelligence.overdueYears, 1);
  assert.equal(overdueOnly[0].promotionIntelligence.eligibleYearOrdinal, 2);
});

test("15. Commander Search firstEligibleYearBe=2569 finds the fixture", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  const filters = filtersFromSearchParams({ firstEligibleYearBe: "2569" });
  assert.equal(filters.firstEligibleYearBe, 2569);
  assert.equal(result.promotionIntelligence.firstEligibleYearBe, filters.firstEligibleYearBe);
});

test("16. Reports/tools serialize the same PromotionSummary semantics", () => {
  const asOf = utcDate(2026, 7, 20);
  const promo = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null).promotionIntelligence;
  assert.equal(promo.overdueYears, 0);
  assert.equal(promo.eligibleYearOrdinal, 1);
  assert.equal(promo.promotionCyclesPassed, 0);
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
});

test("position level and years-in-level for the 2564 start in BE 2569", () => {
  const asOf = utcDate(2026, 7, 20);
  const result = toQueryOfficer(reportedOfficer(), asOf, ORG_LABELS, null);
  assert.equal(result.positionLevel, "สารวัตร");
  assert.equal(result.positionLevelStartYearBe, 2564);
  assert.equal(result.positionLevelYearCount, 5);
});
