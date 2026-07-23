/**
 * Phase 49C — Executive report builders, filters, brief, CSV, print metadata.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReportFilters, describeReportFiltersTh } from "@/lib/commander_reports/apply_filters";
import { buildCommanderBrief } from "@/lib/commander_reports/build_brief";
import { buildExecutiveReport } from "@/lib/commander_reports/build_report";
import { buildExecutiveReportCsv } from "@/lib/commander_reports/export_csv";
import { buildReportPrintMeta } from "@/lib/commander_reports/export_print";
import { EXECUTIVE_REPORT_TYPES, REPORT_VERSION } from "@/lib/commander_reports/types";
import { REPORT_CATALOG, resolveReportType } from "@/lib/commander_reports/report_catalog";
import type { CommanderQueryOfficer, CommanderQueryOptions } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";

const ASOF = new Date("2026-07-23T00:00:00.000Z");

function fakePromotion(partial: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: null,
    overdueYears: null,
    targetLevel: null,
    currentRank: null,
    currentPosition: null,
    targetRank: null,
    targetPosition: null,
    promotionStatus: "NotEligible",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: null,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    priority: null,
    priorityReason: null,
    ...partial,
  };
}

function fakeTraining(partial: Partial<TrainingSummary> = {}): TrainingSummary {
  return {
    available: false,
    asOfDate: "2026-07-23",
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
    displayStatusTh: "ไม่มีข้อมูลหลักสูตร",
    recommendationsTh: [],
    dataQualityFlags: [],
    ...partial,
  };
}

function officer(id: string, overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  const documentIntelligence =
    overrides.documentIntelligence ??
    composeOfficerDocumentIntelligence({ officerId: id, officerPk: 1, documents: [], asOf: ASOF });
  return {
    officerId: id,
    rank: "ร.ต.อ.",
    firstName: "ทดสอบ",
    lastName: id,
    displayName: `Officer ${id}`,
    currentPosition: "รอง สว.",
    positionLevel: "สว.",
    currentUnit: "กก.1",
    regionId: 1,
    battalionId: 10,
    companyId: 100,
    companyLabel: "ร้อย.1",
    yearsInRank: null,
    yearsInPosition: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
    completedPromotionCycles: null,
    governmentServiceYears: null,
    ageYears: 40,
    retirementYear: 2030,
    retirementYearBe: 2573,
    promotionStatus: "not_eligible",
    retirementStatus: "normal",
    priority: "low",
    profileCompletenessPercent: 100,
    flags: [],
    flagCodes: [],
    hasGp7: false,
    hasOfficialPortrait: false,
    hasTraining: false,
    hasDocuments: false,
    academyClass: null,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: fakePromotion(),
    trainingIntelligence: fakeTraining(),
    dateOfBirth: new Date("1986-08-01T00:00:00.000Z"),
    displayServiceDurationTh: null,
    positionLevelStartYearBe: null,
    displayAgeYearsMonthsTh: "40 ปี, 0 เดือน",
    appointmentCycle: null,
    eligibleCycle: null,
    overdueCycles: 0,
    promotionCycleBucket: "not_eligible",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence,
    documentExpiryInfo: [],
    ...overrides,
  };
}

const OPTIONS: CommanderQueryOptions = {
  ranks: ["ร.ต.อ."],
  positionLevels: ["สว."],
  regions: [{ id: 1, label: "ภาค 4" }],
  battalions: [{ id: 10, regionId: 1, label: "กก.1" }],
  companies: [{ id: 100, battalionId: 10, label: "ร้อย.1" }],
  priorities: ["low", "medium", "high", "critical"],
  skillCatalog: { categories: [], levels: [] },
};

test("catalog covers all ten executive report types", () => {
  assert.equal(REPORT_CATALOG.length, 10);
  for (const type of EXECUTIVE_REPORT_TYPES) {
    assert.ok(REPORT_CATALOG.some((e) => e.type === type), type);
  }
});

test("unknown report ids safely fall back to Personnel Executive Summary", () => {
  assert.equal(resolveReportType("not-a-real-report"), "personnelSummary");
  assert.equal(resolveReportType(""), "personnelSummary");
  assert.equal(resolveReportType(undefined), "personnelSummary");
  const report = buildExecutiveReport({
    type: "totally-unknown",
    officers: [officer("a")],
    options: OPTIONS,
    filters: {},
    asOf: ASOF,
    preparedByTh: "Admin",
  });
  assert.equal(report.type, "personnelSummary");
  assert.match(report.cover.titleTh, /สรุปกำลังพลผู้บริหาร/);
});

test("applyReportFilters: org + priority combinations", () => {
  const officers = [
    officer("a", { regionId: 1, battalionId: 10, companyId: 100, priority: "critical" }),
    officer("b", { regionId: 2, battalionId: 20, companyId: 200, priority: "low" }),
  ];
  const filtered = applyReportFilters(officers, { regionId: 1, priority: "critical" }, ASOF);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.officerId, "a");
});

test("applyReportFilters does not mutate the source officer array", () => {
  const officers = [officer("a"), officer("b", { regionId: 2 })];
  const snapshot = officers.map((o) => o.officerId);
  applyReportFilters(officers, { regionId: 1 }, ASOF);
  assert.deepEqual(
    officers.map((o) => o.officerId),
    snapshot
  );
  assert.equal(officers.length, 2);
});

test("clearing filters restores the full filtered dataset for personnel summary", () => {
  const officers = [officer("a"), officer("b", { regionId: 2 })];
  const narrowed = buildExecutiveReport({
    type: "personnelSummary",
    officers,
    options: OPTIONS,
    filters: { regionId: 1 },
    asOf: ASOF,
    preparedByTh: "Admin",
  });
  const cleared = buildExecutiveReport({
    type: "personnelSummary",
    officers,
    options: OPTIONS,
    filters: {},
    asOf: ASOF,
    preparedByTh: "Admin",
  });
  assert.equal(narrowed.resultCount, 1);
  assert.equal(cleared.resultCount, 2);
});

test("describeReportFiltersTh includes org labels", () => {
  const text = describeReportFiltersTh({ regionId: 1, battalionId: 10 }, OPTIONS);
  assert.match(text, /ภาค 4/);
  assert.match(text, /กก\.1/);
});

test("Commander brief tallies existing fields only", () => {
  const officers = [
    officer("a", {
      priority: "critical",
      nextLevelEligibility: {
        targetLevel: "สว.",
        status: "eligible_now",
        eligibleNow: true,
        monthsUntilEligible: 0,
        overdueYears: 0,
        appointmentCycle: null,
        eligibleCycle: null,
        overdueCycles: 0,
        completedPromotionCycles: null,
        promotionCycleBucket: "eligible_this_cycle",
      },
      retirementYear: 2026,
      documentIntelligence: {
        ...composeOfficerDocumentIntelligence({ officerId: "a", officerPk: 1, documents: [], asOf: ASOF }),
        expiredCount: 1,
        readinessLevel: "READY",
      },
      trainingIntelligence: fakeTraining({ trainingStatus: "MissingRequired", displayStatusTh: "ขาดหลักสูตร" }),
    }),
  ];
  const brief = buildCommanderBrief(officers, ASOF);
  assert.equal(brief.totalPersonnel, 1);
  assert.equal(brief.readyForPromotion, 1);
  assert.equal(brief.retiringWithin12Months, 1);
  assert.equal(brief.expiredDocuments, 1);
  assert.equal(brief.missingTraining, 1);
  assert.equal(brief.criticalOfficers, 1);
  assert.equal(brief.aiReady, 1);
  assert.ok(brief.actionItemsTh.length > 0);
});

test("every report type builds without fabricating sensitive fields", () => {
  const officers = [
    officer("a", { priority: "high" }),
    officer("b", {
      priority: "critical",
      dateOfBirth: new Date("1986-08-01T00:00:00.000Z"),
      promotionIntelligence: fakePromotion({ promotionStatus: "AlreadyEligible", displayStatusTh: "ครบแล้ว" }),
      nextLevelEligibility: {
        targetLevel: "สว.",
        status: "eligible_now",
        eligibleNow: true,
        monthsUntilEligible: 0,
        overdueYears: 0,
        appointmentCycle: null,
        eligibleCycle: null,
        overdueCycles: 0,
        completedPromotionCycles: null,
        promotionCycleBucket: "eligible_this_cycle",
      },
    }),
  ];
  for (const type of EXECUTIVE_REPORT_TYPES) {
    const report = buildExecutiveReport({
      type,
      officers,
      options: OPTIONS,
      filters: {},
      asOf: ASOF,
      preparedByTh: "Admin",
    });
    assert.equal(report.type, type);
    assert.equal(report.cover.reportVersion, REPORT_VERSION);
    assert.ok(report.cover.titleTh.length > 0);
    assert.ok(report.recommendations.length >= 1);
    assert.ok(report.kpis.length >= 1);
    const blob = JSON.stringify(report);
    assert.equal(blob.includes("nationalId"), false);
    assert.equal(blob.includes("fingerprint"), false);
    assert.equal(blob.includes("ocrRawText"), false);
  }
});

test("highPriority report projects only high/critical officers", () => {
  const report = buildExecutiveReport({
    type: "highPriority",
    officers: [officer("a", { priority: "low" }), officer("b", { priority: "critical" })],
    options: OPTIONS,
    filters: {},
    asOf: ASOF,
    preparedByTh: "Admin",
  });
  assert.equal(report.resultCount, 1);
  assert.equal(report.rows[0]!.officerId, "b");
});

test("empty filter+report yields honest empty recommendation", () => {
  const report = buildExecutiveReport({
    type: "documentCompleteness",
    officers: [
      officer("a", {
        documentIntelligence: {
          ...composeOfficerDocumentIntelligence({ officerId: "a", officerPk: 1, documents: [], asOf: ASOF }),
          missingRequiredCount: 0,
          expiredCount: 0,
          readinessLevel: "READY",
        },
      }),
    ],
    options: OPTIONS,
    filters: {},
    asOf: ASOF,
    preparedByTh: "Admin",
  });
  assert.equal(report.resultCount, 0);
  assert.match(report.recommendations[0]!.textTh, /ไม่มีรายการ/);
});

test("CSV starts with UTF-8 BOM and includes cover metadata", () => {
  const report = buildExecutiveReport({
    type: "personnelSummary",
    officers: [officer("a")],
    options: OPTIONS,
    filters: { regionId: 1 },
    asOf: ASOF,
    preparedByTh: "ผู้จัดทำทดสอบ",
  });
  const csv = buildExecutiveReportCsv(report);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /สรุปกำลังพลผู้บริหาร/);
  assert.match(csv, /ผู้จัดทำทดสอบ/);
  assert.match(csv, /ชั้นความลับ/);
  assert.equal(csv.includes("nationalId"), false);
});

test("print metadata includes signature and confidential footer", () => {
  const report = buildExecutiveReport({
    type: "monthlyBrief",
    officers: [officer("a")],
    options: OPTIONS,
    filters: {},
    asOf: ASOF,
    preparedByTh: "Admin",
  });
  const meta = buildReportPrintMeta(report);
  assert.match(meta.signatureCommanderTh, /ผู้บังคับบัญชา/);
  assert.match(meta.signaturePreparerTh, /Admin/);
  assert.equal(meta.reportVersion, REPORT_VERSION);
  assert.match(meta.confidentialTh, /ชั้นความลับ/);
  assert.match(meta.landscapeHintTh, /Landscape|แนวนอน/);
});
