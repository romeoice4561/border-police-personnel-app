/**
 * Phase 49.12 — Promotion presentation view-model regression tests.
 *
 * Sanitized fixtures only. Presentation must not invent blockers, use “วาระ”,
 * or recalculate eligibility — it formats already-composed VM fields.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { utcDate } from "@/lib/personnel_calendar";
import { composeOfficerIntelligenceViewModel } from "@/lib/officer_intelligence/view_model";
import { buildPromotionPresentation } from "@/lib/officer_intelligence/promotion_presentation";
import { INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import { policyForTargetLevel } from "@/lib/promotion/eligibility_policy";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "TEST-P4912",
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
const ASOF_2569 = utcDate(2026, 7, 24);

function sarawatSince(startYearBe: number, opts?: { rankChangeYearBe?: number }) {
  const rows = [
    timelineRow({
      id: 1,
      sequence: 0,
      yearBE: startYearBe,
      year: String(startYearBe),
      day: 1,
      month: 10,
      appointmentCycle: startYearBe,
      position: "สารวัตรป้องกันและปราบปราม",
      positionLevel: "สารวัตร",
      rank: "ร.ต.อ.",
      unit: "กก.ตชด.41",
      isPresent: opts?.rankChangeYearBe == null,
    }),
  ];
  if (opts?.rankChangeYearBe != null) {
    rows.push(
      timelineRow({
        id: 2,
        sequence: 1,
        yearBE: opts.rankChangeYearBe,
        year: String(opts.rankChangeYearBe),
        day: 1,
        month: 4,
        appointmentCycle: opts.rankChangeYearBe,
        position: "สารวัตรป้องกันและปราบปราม",
        positionLevel: "สารวัตร",
        rank: "พ.ต.ท.",
        unit: "กก.ตชด.41",
        isPresent: true,
      })
    );
  }
  return officer({ timeline: rows });
}

function basePresentationInput(
  overrides: Partial<{
    asOfDate: string;
    identity: Partial<OfficerIntelligenceViewModel["identity"]>;
    service: Partial<OfficerIntelligenceViewModel["service"]>;
    promotion: Partial<OfficerIntelligenceViewModel["promotion"]>;
  }> = {}
): Pick<OfficerIntelligenceViewModel, "asOfDate" | "identity" | "service" | "promotion"> {
  return {
    asOfDate: overrides.asOfDate ?? "2026-07-24",
    identity: {
      officerId: "TEST",
      displayName: "ทดสอบ ระบบ",
      rank: "พ.ต.ท.",
      position: "สารวัตร",
      positionLevel: "สารวัตร",
      unit: "กก.ตชด.41",
      officialPortraitUrl: null,
      ...overrides.identity,
    },
    service: {
      available: true,
      serviceStartDate: null,
      displayServiceDurationTh: "5 ปี",
      yearsInCurrentPositionLevel: 5,
      currentPositionLevelStartYearBe: 2564,
      ...overrides.service,
    },
    promotion: {
      available: true,
      targetPositionTh: "รองผู้กำกับการ",
      qualificationTextTh: "ครบขึ้น รองผู้กำกับการ",
      status: "EligibleThisYear",
      displayStatusTh: "ครบคุณสมบัติในปีนี้",
      firstEligibleYearBe: 2569,
      displayFirstEligibleYearTh: "พ.ศ. 2569",
      firstEligibleDate: "2026-01-01",
      requiredTenureYears: 5,
      waitingReasonTh: null,
      displayReasonTh: "ดำรงระดับสารวัตรครบเกณฑ์ 5 ปีแล้ว",
      remainingTenureYears: 0,
      displayRemainingTenureTh: "ครบเกณฑ์แล้ว",
      waitingYears: null,
      displayWaitingTh: "ครบคุณสมบัติในปีนี้",
      eligibilityYearNumber: 1,
      yearsInCurrentLevel: 5,
      promotionCyclesPassed: 0,
      blockers: [],
      currentRankStartedAtYearBe: 2568,
      yearsInCurrentRank: 1,
      confidence: "confirmed",
      confidenceReasonTh: null,
      missingEvidence: [],
      ...overrides.promotion,
    },
  };
}

test("CASE 1 — eligible this year: 5/5, 100%, ปีที่ 1, รอบที่ 1", () => {
  const vm = composeOfficerIntelligenceViewModel(sarawatSince(2564, { rankChangeYearBe: 2568 }), ORG, null, ASOF_2569);
  const p = buildPromotionPresentation(vm);

  assert.equal(p.statusLabelTh, "ครบคุณสมบัติในปีนี้");
  assert.equal(p.kpiStatusLabelTh, "ครบคุณสมบัติในปีนี้");
  assert.equal(p.remainingTenureLabel, "ครบเกณฑ์แล้ว");
  assert.equal(p.kpiRemainingTenureLabel, "ครบเกณฑ์แล้ว");
  assert.equal(p.progressCurrent, 5);
  assert.equal(p.progressRequired, 5);
  assert.equal(p.progressPercent, 100);
  assert.equal(p.progressLabelTh, "5 จาก 5 ปี");
  assert.equal(p.kpiReadinessLabel, "100%");
  assert.equal(p.firstEligibleYearLabel, "พ.ศ. 2569");
  assert.equal(p.kpiFirstEligibleYearLabel, "พ.ศ. 2569");
  assert.equal(p.eligibilityYearOrdinalLabel, "ปีที่ 1");
  assert.equal(p.appointmentRoundLabel, "รอบที่ 1");
  assert.equal(p.currentLevelLabel, "สารวัตร");
  assert.equal(p.targetLevelLabel, "รองผู้กำกับการ");
  assert.match(p.reasonTh, /สารวัตร/);
  assert.match(p.reasonTh, /5 ปี/);
  assert.match(p.reasonTh, /รองผู้กำกับการ/);
  assert.match(p.reasonTh, /2569/);
  assert.ok(p.recommendedActionTh.length > 0);
  assert.equal(p.reasonTh.includes("วาระ"), false);
  assert.notEqual(p.statusLabelTh, "ยังไม่ครบคุณสมบัติ");
  assert.equal(p.reasonTh.includes("2570"), false);
  assert.ok(p.requirementItems.some((i) => i.key === "tenure" && i.state === "complete"));
  assert.ok(!p.requirementItems.some((i) => i.state === "missing" && i.key === "training"));
  assert.ok(p.timelineItems.some((i) => i.key === "start" && i.yearLabel.includes("2564")));
  assert.ok(p.timelineItems.some((i) => i.key === "first_eligible" && i.yearLabel.includes("2569")));
  assert.ok(p.timelineItems.some((i) => i.key === "current" && i.titleTh.includes("ปีที่ 1")));
  assert.ok(p.readinessMeaningTh?.includes("ครบเกณฑ์ด้านระยะเวลา"));
});

test("CASE 2 — not yet eligible: 2/5, 40%, no ordinal/round", () => {
  const vm = composeOfficerIntelligenceViewModel(sarawatSince(2567), ORG, null, ASOF_2569);
  const p = buildPromotionPresentation(vm);

  assert.equal(p.statusLabelTh, "ยังไม่ครบคุณสมบัติ");
  assert.equal(p.remainingTenureLabel, "ประมาณ 3 ปี");
  assert.equal(p.progressCurrent, 2);
  assert.equal(p.progressRequired, 5);
  assert.equal(p.progressPercent, 40);
  assert.equal(p.progressLabelTh, "2 จาก 5 ปี");
  assert.equal(p.kpiReadinessLabel, "40%");
  assert.equal(p.firstEligibleYearLabel, "พ.ศ. 2572");
  assert.equal(p.eligibilityYearOrdinalLabel, null);
  assert.equal(p.appointmentRoundLabel, null);
  assert.equal(p.waitingLabel, null);
  assert.ok(p.requirementItems.some((i) => i.key === "tenure" && i.state === "missing"));
  assert.ok(p.timelineItems.some((i) => i.titleTh.includes("คาดว่าจะครบคุณสมบัติครั้งแรก")));
  assert.ok(p.timelineItems.some((i) => i.titleTh.includes("2 จาก 5")));
});

test("CASE 3 — eligible from previous year: ordinal 2, overdue 1", () => {
  const vm = composeOfficerIntelligenceViewModel(sarawatSince(2563), ORG, null, ASOF_2569);
  const p = buildPromotionPresentation(vm);

  assert.equal(p.statusLabelTh, "ครบคุณสมบัติมาแล้ว");
  assert.equal(p.waitingLabel, "รอการพิจารณามาแล้ว 1 ปี");
  assert.equal(p.eligibilityYearOrdinalLabel, "ปีที่ 2");
  assert.equal(p.appointmentRoundLabel, "รอบที่ 2");
  assert.equal(p.progressPercent, 100);
  assert.equal(p.kpiReadinessLabel, "100%");
  assert.ok(p.timelineItems.some((i) => i.key === "first_eligible" && i.yearLabel.includes("2568")));
  assert.ok(p.timelineItems.some((i) => i.key === "current" && (i.titleTh.includes("ปีที่ 2") || i.yearLabel.includes("2569"))));
  assert.match(p.reasonTh, /2568/);
  assert.match(p.reasonTh, /ปีที่ 2/);
});

test("CASE 4 — incomplete evidence: no fake progress/year", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ timeline: [], currentPosition: "สารวัตร" }), ORG, null, ASOF_2569);
  const p = buildPromotionPresentation(vm);

  assert.equal(p.statusLabelTh, "ข้อมูลยังไม่เพียงพอ");
  assert.equal(p.remainingTenureLabel, "ประเมินไม่ได้");
  assert.equal(p.progressPercent, null);
  assert.equal(p.progressCurrent, null);
  assert.equal(p.kpiReadinessLabel, "ประเมินไม่ได้");
  assert.equal(p.firstEligibleYearLabel, "ประเมินไม่ได้");
  assert.equal(p.eligibilityYearOrdinalLabel, null);
  assert.equal(p.appointmentRoundLabel, null);
  assert.ok(p.requirementItems.some((i) => i.key === "level_start" || i.key === "tenure"));
  assert.match(p.recommendedActionTh, /เริ่มดำรงระดับ/);
  assert.ok(!p.timelineItems.some((i) => i.key === "first_eligible"));
});

test("CASE 5 — year-only evidence confidence wording", () => {
  const p = buildPromotionPresentation(
    basePresentationInput({
      promotion: {
        firstEligibleDate: "2026-01-01",
        confidence: "confirmed",
      },
      service: { currentPositionLevelStartYearBe: 2564 },
    })
  );
  assert.equal(p.positionLevelStartLabel, "พ.ศ. 2564");
  assert.equal(p.confidenceLabelTh, "ประเมินจากข้อมูลรายปี");
  assert.equal(p.reasonTh.includes("/"), false); // no fabricated day/month path
});

test("CASE 6 — rank change does not reset position-level progress", () => {
  const vm = composeOfficerIntelligenceViewModel(sarawatSince(2564, { rankChangeYearBe: 2568 }), ORG, null, ASOF_2569);
  const p = buildPromotionPresentation(vm);
  assert.equal(p.positionLevelStartLabel, "พ.ศ. 2564");
  assert.equal(p.progressCurrent, 5);
  assert.equal(p.firstEligibleYearLabel, "พ.ศ. 2569");
  assert.notEqual(p.positionLevelStartLabel, "พ.ศ. 2568");
});

test("CASE 7 — progress capped at 100% when completed > required", () => {
  const p = buildPromotionPresentation(
    basePresentationInput({
      service: { yearsInCurrentPositionLevel: 7 },
      promotion: {
        yearsInCurrentLevel: 7,
        requiredTenureYears: 5,
        status: "AlreadyEligible",
        eligibilityYearNumber: 3,
        waitingYears: 2,
        firstEligibleYearBe: 2567,
        displayRemainingTenureTh: "ครบเกณฑ์แล้ว",
        remainingTenureYears: 0,
      },
    })
  );
  assert.equal(p.progressPercent, 100);
  assert.equal(p.progressLabelTh, "7 จาก 5 ปี");
  assert.equal(p.kpiReadinessLabel, "100%");
});

test("CASE 8 — header fields match detailed card status", () => {
  const vm = composeOfficerIntelligenceViewModel(sarawatSince(2564), ORG, null, ASOF_2569);
  const p = buildPromotionPresentation(vm);
  assert.equal(p.headerStatusLabelTh, p.statusLabelTh);
  assert.equal(p.headerStatusLabelTh, p.kpiStatusLabelTh);
  assert.equal(p.headerQualificationTh, "ครบเกณฑ์ด้านระยะเวลา");
  assert.equal(p.headerTenureLabelTh, p.completedTenureLabel);

  const waiting = buildPromotionPresentation(composeOfficerIntelligenceViewModel(sarawatSince(2567), ORG, null, ASOF_2569));
  assert.equal(waiting.headerStatusLabelTh, waiting.statusLabelTh);
  assert.equal(waiting.headerQualificationTh, "เหลืออีกประมาณ 3 ปี");

  const incomplete = buildPromotionPresentation(
    composeOfficerIntelligenceViewModel(officer({ timeline: [] }), ORG, null, ASOF_2569)
  );
  assert.equal(incomplete.headerQualificationTh, "ประเมินไม่ได้");
  assert.equal(incomplete.headerStatusLabelTh, "ข้อมูลยังไม่เพียงพอ");
});

test("CASE 9 — React components contain no promotion arithmetic", () => {
  const cardPath = path.join(process.cwd(), "components/officer/officer_promotion_intelligence_card.tsx");
  const headerPath = path.join(process.cwd(), "components/officer/officer_intelligence_header.tsx");
  const card = readFileSync(cardPath, "utf8");
  const header = readFileSync(headerPath, "utf8");
  for (const src of [card, header]) {
    assert.equal(src.includes("requiredTenureYears -"), false);
    assert.equal(src.includes("yearsInCurrentLevel /"), false);
    assert.equal(src.includes("eligibilityYearNumber +"), false);
    assert.equal(src.includes("waitingYears -"), false);
    assert.equal(/Math\.(min|max|round|ceil|floor)/.test(src), false);
    assert.ok(src.includes("buildPromotionPresentation"));
  }
});

test("CASE 10 — ground truth preservation + nine tools", () => {
  assert.equal(policyForTargetLevel("รองผู้กำกับการ")?.minYearsInPositionLevel, 5);
  assert.equal(policyForTargetLevel("สารวัตร")?.minYearsInPositionLevel, 7);
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);

  const vm = composeOfficerIntelligenceViewModel(sarawatSince(2564, { rankChangeYearBe: 2568 }), ORG, null, ASOF_2569);
  assert.equal(vm.promotion.status, "EligibleThisYear");
  assert.equal(vm.promotion.firstEligibleYearBe, 2569);
  assert.equal(vm.promotion.eligibilityYearNumber, 1);
  assert.equal(vm.promotion.waitingYears, null);
  assert.equal(vm.promotion.requiredTenureYears, 5);
  assert.equal(vm.service.currentPositionLevelStartYearBe, 2564);

  const p = buildPromotionPresentation(vm);
  assert.equal(p.appointmentRoundLabel, "รอบที่ 1");
  assert.equal(p.reasonTh.includes("วาระ"), false);
});

test("no-target presentation", () => {
  const p = buildPromotionPresentation(
    basePresentationInput({
      promotion: {
        targetPositionTh: null,
        status: "NotEligible",
        available: true,
        yearsInCurrentLevel: null,
        requiredTenureYears: null,
        displayRemainingTenureTh: null,
        firstEligibleYearBe: null,
        eligibilityYearNumber: null,
      },
    })
  );
  assert.match(p.statusLabelTh, /ไม่มีระดับเป้าหมาย|ยังไม่ครบคุณสมบัติ|ข้อมูลยังไม่เพียงพอ/);
});
