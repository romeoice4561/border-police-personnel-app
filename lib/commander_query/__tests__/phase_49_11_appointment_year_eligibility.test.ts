/**
 * Phase 49.11 — annual appointment-year promotion eligibility.
 *
 * Sanitized fixture (no real PII):
 *   - สารวัตร since พ.ศ. 2564 (continuous)
 *   - rank changed to พ.ต.ท. in พ.ศ. 2568 (must not reset level tenure)
 *   - assessment/appointment year พ.ศ. 2569
 *   - target รองผู้กำกับการ, required 5 years
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
import { firstEligibleAppointmentYearBe, currentPromotionCycle } from "@/lib/promotion_cycle";
import { INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "TEST-P4911-SARAWAT",
    rank: "พ.ต.ท.",
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

const ORG = { company: "กองร้อยทดสอบ" };

/** สารวัตร from 2564; rank upgrade พ.ต.ท. in 2568; still สารวัตร. */
function reportedStructure() {
  return officer({
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        yearBE: 2564,
        year: "2564",
        day: 1,
        month: 10,
        appointmentCycle: 2564,
        position: "สารวัตรป้องกันและปราบปราม",
        positionLevel: "สารวัตร",
        rank: "ร.ต.อ.",
        unit: "กก.ตชด.41",
        isPresent: false,
      }),
      timelineRow({
        id: 2,
        sequence: 1,
        yearBE: 2568,
        year: "2568",
        day: 1,
        month: 4,
        appointmentCycle: 2568,
        position: "สารวัตรป้องกันและปราบปราม",
        positionLevel: "สารวัตร",
        rank: "พ.ต.ท.",
        unit: "กก.ตชด.41",
        isPresent: true,
      }),
    ],
  });
}

test("helper: firstEligibleAppointmentYearBe is start + required (no +1)", () => {
  assert.equal(firstEligibleAppointmentYearBe(2564, 5), 2569);
  assert.equal(firstEligibleAppointmentYearBe(2567, 7), 2574);
});

test("appointment year for 24 Jul 2569 / Oct–Dec 2569 remains 2569 (not fiscal 2570)", () => {
  assert.equal(currentPromotionCycle(utcDate(2026, 7, 24)), 2569);
  assert.equal(currentPromotionCycle(utcDate(2026, 10, 15)), 2569);
  assert.equal(currentPromotionCycle(utcDate(2026, 12, 31)), 2569);
});

test("policies: สารวัตร→รองผู้กำกับการ=5; รอง สว.→สารวัตร=7", () => {
  assert.equal(policyForTargetLevel("รองผู้กำกับการ")?.minYearsInPositionLevel, 5);
  assert.equal(policyForTargetLevel("สารวัตร")?.minYearsInPositionLevel, 7);
});

test("boundary 2568: not yet eligible, remaining ~1 year", () => {
  const asOf = utcDate(2025, 7, 24); // BE 2568
  const q = toQueryOfficer(reportedStructure(), asOf, ORG, null);
  const p = q.promotionIntelligence;
  assert.equal(p.eligibleNow, false);
  assert.equal(p.firstEligibleYearBe, 2569);
  assert.equal(p.remainingTenureYears, 1);
  assert.equal(p.displayRemainingTenureTh, "ประมาณ 1 ปี");
  assert.equal(p.displayStatusTh, "ยังไม่ครบคุณสมบัติ");
});

test("1–17. assessment 2569: eligible first cycle; rank 2568 ignored; no exact-day postpone", () => {
  const asOf = utcDate(2026, 7, 24); // BE 2569 — before Oct anniversary
  const q = toQueryOfficer(reportedStructure(), asOf, ORG, null);
  const p = q.promotionIntelligence;
  const vm = composeOfficerIntelligenceViewModel(reportedStructure(), ORG, null, asOf);

  assert.equal(q.positionLevel, "สารวัตร");
  assert.equal(p.targetPosition, "รองผู้กำกับการ");
  assert.equal(q.positionLevelStartYearBe, 2564);
  assert.equal(q.positionLevelYearCount, 5);
  assert.equal(q.rankStartedAtYearBe, 2568, "rank metadata may show 2568");
  assert.equal(p.requiredTenureYears, 5);
  assert.equal(p.firstEligibleYearBe, 2569);
  assert.notEqual(p.firstEligibleYearBe, 2570);
  assert.notEqual(vm.promotion.firstEligibleYearBe, p.firstEligibleFiscalYearBe ?? -1);
  assert.equal(p.eligibleNow, true);
  assert.equal(p.remainingTenureYears, 0);
  assert.equal(p.displayRemainingTenureTh, "ครบเกณฑ์แล้ว");
  assert.equal(p.displayStatusTh, "ครบคุณสมบัติในปีนี้");
  assert.equal(vm.promotion.displayStatusTh, "ครบคุณสมบัติในปีนี้");
  assert.notEqual(vm.promotion.displayStatusTh, "ยังไม่ครบคุณสมบัติ");
  assert.notEqual(vm.promotion.displayRemainingTenureTh, "ประมาณ 1 ปี");
  assert.equal(p.eligibleYearOrdinal, 1);
  assert.equal(p.overdueYears, 0);
  assert.equal(p.promotionCyclesPassed, 0);
  assert.equal(vm.promotion.eligibilityYearNumber, 1);
  assert.ok(p.displayReasonTh);
  assert.ok(!p.displayReasonTh!.includes("วาระ"));
  assert.ok(!p.displayReasonTh!.includes("2568"));
  assert.match(p.displayReasonTh!, /สารวัตร/);
  assert.match(p.displayReasonTh!, /รองผู้กำกับการ/);
  assert.match(p.displayReasonTh!, /2569/);
  assert.equal(p.firstEligibleFiscalYearBe, 2570, "Oct anniversary fiscal retained as metadata only");
});

test("boundary 2570: ordinal 2, overdueYears 1", () => {
  const asOf = utcDate(2027, 7, 24); // BE 2570
  const p = toQueryOfficer(reportedStructure(), asOf, ORG, null).promotionIntelligence;
  assert.equal(p.eligibleNow, true);
  assert.equal(p.firstEligibleYearBe, 2569);
  assert.equal(p.eligibleYearOrdinal, 2);
  assert.equal(p.overdueYears, 1);
  assert.equal(p.promotionCyclesPassed, 1);
});

test("18–20. Dashboard EligibleThisYear; Search 2569; overdue filter excludes", () => {
  const asOf = utcDate(2026, 7, 24);
  const q = toQueryOfficer(reportedStructure(), asOf, ORG, null);
  assert.equal(q.promotionIntelligence.promotionStatus, "EligibleThisYear");
  const source = toDashboardSourceOfficer(q);
  const candidates = buildPromotionPriorityCandidates([{ ...source, priority: source.priority ?? 40 }]);
  assert.equal(candidates[0]?.promotionStatus, "EligibleThisYear");
  assert.equal(candidates[0]?.promotionYearOrdinal, 1);

  const filters = filtersFromSearchParams({ firstEligibleYearBe: "2569" });
  assert.equal(q.promotionIntelligence.firstEligibleYearBe, filters.firstEligibleYearBe);

  const overdue = [q].filter(
    (o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0
  );
  assert.equal(overdue.length, 0);
});

test("21–22. tools=9; service path same PromotionSummary fields", () => {
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
  const asOf = utcDate(2026, 11, 15); // Oct–Dec appointment round still BE 2569
  const p = toQueryOfficer(reportedStructure(), asOf, ORG, null).promotionIntelligence;
  assert.equal(currentPromotionCycle(asOf), 2569);
  assert.equal(p.eligibleNow, true);
  assert.equal(p.firstEligibleYearBe, 2569);
  assert.equal(p.displayStatusTh, "ครบคุณสมบัติในปีนี้");
});
