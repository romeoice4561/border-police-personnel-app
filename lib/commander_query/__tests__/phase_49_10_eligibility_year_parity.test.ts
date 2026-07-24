/**
 * Phase 49.10 — live eligibility-year parity (calendar BE, not fiscal FY).
 *
 * Sanitized structural fixture (no real officer PII):
 *   สารวัตร since พ.ศ. 2564 → รองผู้กำกับการ (5 years) → first eligible พ.ศ. 2569
 *
 * Also covers the Oct-anniversary fiscal trap that previously displayed 2570.
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
import { INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import { PROMOTION_STATUS_DISPLAY_TH } from "@/lib/intelligence/promotion";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "TEST-P4910-SARAWAT",
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

const ORG = { company: "กองร้อยทดสอบ" };

function exactStartOfficer() {
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
  });
}

function yearOnlyStartOfficer() {
  return officer({
    timeline: [
      timelineRow({
        id: 1,
        sequence: 0,
        yearBE: 2564,
        year: "2564",
        appointmentCycle: 2564,
        position: "สารวัตรป้องกันและปราบปราม",
        positionLevel: "สารวัตร",
        rank: "ร.ต.อ.",
        unit: "กก.ตชด.41",
        isPresent: true,
      }),
    ],
  });
}

/** Oct start in BE 2564 — fiscal conversion used to display 2570 incorrectly. */
function octoberStartOfficer() {
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
        isPresent: true,
      }),
    ],
  });
}

const ASOF_24_JUL_2569 = utcDate(2026, 7, 24);

test("1. สารวัตร → รองผู้กำกับการ requires 5 years; รอง สว. → สารวัตร remains 7", () => {
  assert.equal(policyForTargetLevel("รองผู้กำกับการ")?.minYearsInPositionLevel, 5);
  assert.equal(policyForTargetLevel("สารวัตร")?.minYearsInPositionLevel, 7);
});

test("2–4. exact 16 Feb 2564 → first eligible 16 Feb 2569; as-of 24 Jul 2569 eligible", () => {
  const q = toQueryOfficer(exactStartOfficer(), ASOF_24_JUL_2569, ORG, null);
  const p = q.promotionIntelligence;
  assert.equal(p.firstEligibleDate, "2026-02-16");
  assert.equal(p.firstEligibleYearBe, 2569);
  assert.equal(p.eligibleNow, true);
  assert.equal(p.requiredTenureYears, 5);
});

test("5–10. Officer Profile shows 2569 / ครบคุณสมบัติในปีนี้ / no วาระ / first-cycle semantics", () => {
  const vm = composeOfficerIntelligenceViewModel(exactStartOfficer(), ORG, null, ASOF_24_JUL_2569);
  const p = vm.promotion;
  assert.equal(p.firstEligibleYearBe, 2569);
  assert.equal(p.displayFirstEligibleYearTh, "พ.ศ. 2569");
  assert.notEqual(p.firstEligibleYearBe, 2570);
  assert.equal(p.displayStatusTh, "ครบคุณสมบัติในปีนี้");
  assert.notEqual(p.displayStatusTh, "รอครบคุณสมบัติ");
  assert.equal(p.displayWaitingTh, "ครบคุณสมบัติในปีนี้");
  assert.equal(p.eligibilityYearNumber, 1);
  assert.equal(p.waitingYears, null);
  assert.ok(p.displayReasonTh);
  assert.ok(!p.displayReasonTh!.includes("วาระ"));
  assert.ok(!p.waitingReasonTh?.includes("วาระ"));
  assert.match(p.displayReasonTh!, /สารวัตร/);
  assert.match(p.displayReasonTh!, /5 ปี/);
  assert.match(p.displayReasonTh!, /รองผู้กำกับการ/);
  assert.match(p.displayReasonTh!, /2569/);
  assert.equal(p.displayRemainingTenureTh, "ครบเกณฑ์แล้ว");

  const q = toQueryOfficer(exactStartOfficer(), ASOF_24_JUL_2569, ORG, null);
  assert.equal(q.promotionIntelligence.eligibleYearOrdinal, 1);
  assert.equal(q.promotionIntelligence.overdueYears, 0);
  assert.equal(q.promotionIntelligence.promotionCyclesPassed, 0);
});

test("11. year-only start 2564 still produces firstEligibleYearBe = 2569", () => {
  const q = toQueryOfficer(yearOnlyStartOfficer(), ASOF_24_JUL_2569, ORG, null);
  assert.equal(q.promotionIntelligence.firstEligibleDate, "2026-01-01");
  assert.equal(q.promotionIntelligence.firstEligibleYearBe, 2569);
  assert.equal(q.promotionIntelligence.eligibleNow, true);
});

test("12. Oct anniversary: calendar firstEligibleYearBe=2569 even when fiscal year is 2570", () => {
  const q = toQueryOfficer(octoberStartOfficer(), ASOF_24_JUL_2569, ORG, null);
  const p = q.promotionIntelligence;
  assert.equal(p.firstEligibleDate, "2026-10-01");
  assert.equal(p.firstEligibleYearBe, 2569, "calendar BE year of 1 Oct 2026");
  assert.equal(p.firstEligibleFiscalYearBe, 2570, "Thai FY for Oct+ dates");
  const vm = composeOfficerIntelligenceViewModel(octoberStartOfficer(), ORG, null, ASOF_24_JUL_2569);
  assert.equal(vm.promotion.firstEligibleYearBe, 2569);
  assert.notEqual(vm.promotion.firstEligibleYearBe, 2570);
  // Exact anniversary not yet reached in July — waiting is allowed, but not with 2570 label.
  assert.equal(p.eligibleNow, false);
  assert.equal(vm.promotion.displayStatusTh, "ยังไม่ครบคุณสมบัติ");
  assert.notEqual(vm.promotion.displayStatusTh, "รอครบคุณสมบัติ");
});

test("UI failure regression: start 2564 + tenure 5 + required 5 must never yield firstEligible 2570 + รอครบคุณสมบัติ when anniversary is in calendar 2569", () => {
  for (const source of [exactStartOfficer(), yearOnlyStartOfficer(), octoberStartOfficer()]) {
    const q = toQueryOfficer(source, ASOF_24_JUL_2569, ORG, null);
    const vm = composeOfficerIntelligenceViewModel(source, ORG, null, ASOF_24_JUL_2569);
    assert.equal(q.positionLevelStartYearBe, 2564);
    assert.equal(q.positionLevelYearCount, 5);
    assert.equal(q.promotionIntelligence.requiredTenureYears, 5);
    assert.equal(vm.promotion.firstEligibleYearBe, 2569);
    assert.notEqual(vm.promotion.firstEligibleYearBe, 2570);
    assert.notEqual(vm.promotion.displayStatusTh, "รอครบคุณสมบัติ");
  }
});

test("13–15. Dashboard EligibleThisYear + Search 2569 + overdue filter", () => {
  const q = toQueryOfficer(exactStartOfficer(), ASOF_24_JUL_2569, ORG, null);
  assert.equal(q.promotionIntelligence.promotionStatus, "EligibleThisYear");
  const source = toDashboardSourceOfficer(q);
  const candidates = buildPromotionPriorityCandidates([{ ...source, priority: source.priority ?? 40 }]);
  assert.equal(candidates[0]?.promotionStatus, "EligibleThisYear");
  assert.equal(candidates[0]?.promotionYearOrdinal, 1);

  const filters = filtersFromSearchParams({ firstEligibleYearBe: "2569" });
  assert.equal(q.promotionIntelligence.firstEligibleYearBe, filters.firstEligibleYearBe);

  const overdueOnly = [q].filter(
    (o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0
  );
  assert.equal(overdueOnly.length, 0);
});

test("16–18. tools=9; status labels; seven-year rule intact", () => {
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
  assert.equal(PROMOTION_STATUS_DISPLAY_TH.EligibleThisYear, "ครบคุณสมบัติในปีนี้");
  assert.equal(PROMOTION_STATUS_DISPLAY_TH.Waiting, "ยังไม่ครบคุณสมบัติ");
  assert.equal(policyForTargetLevel("สารวัตร")?.minYearsInPositionLevel, 7);
});
