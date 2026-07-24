/**
 * Commander Intelligence Center — view model tests (Phase 49B).
 *
 * Proves KPIs / Priority Matrix / Action Center / Timeline / Executive
 * Table / Executive Summary are pure aggregations over already-computed
 * CommanderQueryOfficer / CommanderDashboard / CommanderDashboardViewModel
 * fixtures — no engine math is re-derived here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCommanderIntelligenceCenter } from "@/lib/commander_intelligence_center/build_view_model";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { computeExpiryInfo } from "@/lib/document/document_expiry";
import { fixtureDoc, fullChecklistDocs } from "@/lib/integration/documents/__tests__/test_fixtures";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderDashboard } from "@/lib/intelligence";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";

const ASOF = new Date("2026-07-23T00:00:00.000Z");

const EMPTY_CATALOG = { categories: [], levels: [] };

function fakePromotion(overrides: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: null,
    overdueYears: null,
    eligibleYearOrdinal: null,
    targetLevel: null,
    currentRank: null,
    currentPosition: null,
    targetRank: null,
    targetPosition: null,
    promotionStatus: "NotEligible",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    firstEligibleDate: null,
    firstEligibleFiscalYearBe: null,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: null,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    requiredTenureYears: null,
    waitingReasonTh: null,
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: null,
    priorityReason: null,
    ...overrides,
  };
}

function fakeTraining(overrides: Partial<TrainingSummary> = {}): TrainingSummary {
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
    ...overrides,
  };
}

function fakeOfficer(officerId: string, overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  const documents = overrides.documentExpiryInfo ? overrides.documentExpiryInfo.map((i) => i.document) : [];
  const documentIntelligence =
    overrides.documentIntelligence ??
    composeOfficerDocumentIntelligence({ officerId, officerPk: 1, documents, asOf: ASOF });

  return {
    officerId,
    rank: "ร.ต.อ.",
    displayName: `Officer ${officerId}`,
    currentPosition: "รอง สว.",
    currentUnit: "กก.1",
    regionId: null,
    battalionId: null,
    companyId: null,
    companyLabel: "",
    yearsInRank: null,
    yearsInPosition: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
    completedPromotionCycles: null,
    governmentServiceYears: null,
    ageYears: null,
    retirementYear: null,
    retirementYearBe: null,
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
    dateOfBirth: null,
    displayServiceDurationTh: null,
    positionLevelStartYearBe: null,
    displayAgeYearsMonthsTh: null,
    appointmentCycle: null,
    eligibleCycle: null,
    overdueCycles: 0,
    promotionCycleBucket: "not_eligible",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence,
    documentExpiryInfo: computeExpiryInfo(documents, ASOF),
    ...overrides,
  } as CommanderQueryOfficer;
}

function datasetFrom(officers: CommanderQueryOfficer[]): CommanderQueryDataset {
  return {
    officers,
    options: {
      ranks: [],
      positionLevels: [],
      regions: [],
      battalions: [],
      companies: [],
      priorities: ["low", "medium", "high", "critical"],
      skillCatalog: EMPTY_CATALOG,
    },
  };
}

function dashboardFrom(
  officers: CommanderQueryOfficer[],
  priorities: Record<string, "low" | "medium" | "high" | "critical">
): CommanderDashboard {
  return {
    summary: {
      totalOfficers: officers.length,
      promotionReady: 0,
      nearPromotion: 0,
      retiringSoon: 0,
      incompleteProfiles: officers.filter((o) => (o.profileCompletenessPercent ?? 100) < 100).length,
      missingDocuments: 0,
      missingGp7: 0,
      missingPortrait: 0,
      missingTraining: 0,
    },
    officers: officers.map((o) => ({
      officerId: o.officerId,
      displayName: o.displayName,
      promotionStatus: "not_eligible",
      retirementStatus: "normal",
      profileCompleteness: "high",
      profileCompletenessPercent: o.profileCompletenessPercent,
      priority: priorities[o.officerId] ?? "low",
      priorityScore: 0,
      flags: [],
      recommendations: [],
      promotionResult: null,
    })),
  };
}

function emptyViewModel(overrides: Partial<CommanderDashboardViewModel> = {}): CommanderDashboardViewModel {
  return {
    generatedAt: "2026-07-23",
    fiscalYearBe: 2569,
    displayFiscalYearTh: "ปีงบประมาณ 2569",
    personnelOverview: { totalPersonnel: 0, activePersonnel: 0, dataUnavailableCount: 0 },
    promotion: {
      eligibleThisYear: 0,
      alreadyEligible: 0,
      waiting: 0,
      missingTraining: 0,
      missingDocuments: 0,
      retirementRestricted: 0,
      unknown: 0,
      priorityCandidates: [],
    },
    birthdays: { todayCount: 0, nextSevenDaysCount: 0, thisMonthCount: 0, today: [], nextSevenDays: [], thisMonth: [] },
    retirement: { withinOneYear: 0, withinThreeYears: 0, withinFiveYears: 0, candidates: [] },
    training: {
      missingRequiredCount: 0,
      expiredCount: 0,
      expiringSoonCount: 0,
      unverifiedCount: 0,
      noPolicyCount: 0,
      noDataCount: 0,
      unavailableCount: 0,
      policyConfigured: false,
      priorityOfficers: [],
    },
    actionCenter: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

test("KPI: personnel count matches dataset length and links to unfiltered Commander Search", () => {
  const officers = [fakeOfficer("a"), fakeOfficer("b")];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, {});
  const viewModel = emptyViewModel({ personnelOverview: { totalPersonnel: 2, activePersonnel: 2, dataUnavailableCount: 0 } });

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const personnelKpi = center.kpis.find((k) => k.id === "personnel")!;
  assert.equal(personnelKpi.value, 2);
  assert.equal(personnelKpi.href, "/commander-search");
});

test("KPI: criticalOfficers counts only officers whose OfficerIntelligenceCard.priority is 'critical'", () => {
  const officers = [fakeOfficer("a"), fakeOfficer("b"), fakeOfficer("c")];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, { a: "critical", b: "high", c: "low" });
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const kpi = center.kpis.find((k) => k.id === "criticalOfficers")!;
  assert.equal(kpi.value, 1);
  assert.equal(kpi.href, "/commander-search?priority=critical");
});

test("KPI: trainingMissing has no drilldown href when no training policy is configured (no fake link)", () => {
  const officers = [fakeOfficer("a")];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, {});
  const viewModel = emptyViewModel({ training: { ...emptyViewModel().training, missingRequiredCount: 0, policyConfigured: false } });

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const kpi = center.kpis.find((k) => k.id === "trainingMissing")!;
  assert.equal(kpi.href, null);
});

test("KPI: documentsMissing counts officers with a real missingRequiredCount > 0", () => {
  const withMissing = fakeOfficer("missing", {
    documentIntelligence: composeOfficerDocumentIntelligence({ officerId: "missing", officerPk: 1, documents: [], asOf: ASOF }),
  });
  const complete = fakeOfficer("complete", {
    documentIntelligence: composeOfficerDocumentIntelligence({
      officerId: "complete",
      officerPk: 2,
      documents: fullChecklistDocs({ expiryDate: new Date("2030-01-01") }),
      asOf: ASOF,
    }),
  });
  const officers = [withMissing, complete];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const kpi = center.kpis.find((k) => k.id === "documentsMissing")!;
  assert.equal(kpi.value, 1);
});

// ---------------------------------------------------------------------------
// Priority Matrix
// ---------------------------------------------------------------------------

test("Priority Matrix: buckets officers by the EXISTING OfficerIntelligenceCard.priority, never recomputes a score", () => {
  const officers = [fakeOfficer("a"), fakeOfficer("b"), fakeOfficer("c"), fakeOfficer("d")];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, { a: "critical", b: "high", c: "medium", d: "low" });
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.deepEqual(
    center.priorityMatrix.map((b) => [b.key, b.count]),
    [
      ["critical", 1],
      ["high", 1],
      ["medium", 1],
      ["low", 1],
    ]
  );
  assert.equal(center.priorityMatrix[0].href, "/commander-search?priority=critical");
});

test("Priority Matrix: all four buckets are always present, even when empty (never omitted)", () => {
  const dataset = datasetFrom([]);
  const dashboard = dashboardFrom([], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.equal(center.priorityMatrix.length, 4);
  assert.ok(center.priorityMatrix.every((b) => b.count === 0));
});

// ---------------------------------------------------------------------------
// Action Center
// ---------------------------------------------------------------------------

test("Action Center: zero-count actions have a null href (never a dead link)", () => {
  const dataset = datasetFrom([]);
  const dashboard = dashboardFrom([], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.ok(center.actionCenter.every((item) => item.count > 0 || item.href === null));
});

test("Action Center: reviewMissingDocuments count matches documentsMissing KPI (same underlying tally)", () => {
  const officer = fakeOfficer("a", {
    documentIntelligence: composeOfficerDocumentIntelligence({ officerId: "a", officerPk: 1, documents: [], asOf: ASOF }),
  });
  const dataset = datasetFrom([officer]);
  const dashboard = dashboardFrom([officer], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const kpi = center.kpis.find((k) => k.id === "documentsMissing")!;
  const action = center.actionCenter.find((a) => a.id === "reviewMissingDocuments")!;
  assert.equal(action.count, kpi.value);
  assert.ok(action.href);
});

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

test("Timeline: a document expiring in 15 days appears in the next30 bucket", () => {
  const expiringDoc = fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2026-08-07") }); // 15 days after ASOF
  const officer = fakeOfficer("a", { documentExpiryInfo: computeExpiryInfo([expiringDoc], ASOF) });
  const dataset = datasetFrom([officer]);
  const dashboard = dashboardFrom([officer], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const bucket30 = center.timeline.find((b) => b.horizon === 30);
  assert.ok(bucket30);
  assert.ok(bucket30!.events.some((e) => e.kind === "documentExpiry" && e.officerId === "a"));
});

test("Timeline: an already-expired document is treated as within the next30 window (urgent, not excluded)", () => {
  const expiredDoc = fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2026-07-01") });
  const officer = fakeOfficer("a", { documentExpiryInfo: computeExpiryInfo([expiredDoc], ASOF) });
  const dataset = datasetFrom([officer]);
  const dashboard = dashboardFrom([officer], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const bucket30 = center.timeline.find((b) => b.horizon === 30);
  assert.ok(bucket30!.events.some((e) => e.kind === "documentExpiry"));
});

test("Timeline: a document expiring in 200 days does not appear in any bucket (beyond the 90-day horizon)", () => {
  const farDoc = fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2027-02-08") });
  const officer = fakeOfficer("a", { documentExpiryInfo: computeExpiryInfo([farDoc], ASOF) });
  const dataset = datasetFrom([officer]);
  const dashboard = dashboardFrom([officer], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const allEvents = center.timeline.flatMap((b) => b.events);
  assert.ok(!allEvents.some((e) => e.officerId === "a"));
});

test("Timeline: empty buckets are omitted entirely", () => {
  const dataset = datasetFrom([fakeOfficer("a")]);
  const dashboard = dashboardFrom([fakeOfficer("a")], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.deepEqual(center.timeline, []);
});

// ---------------------------------------------------------------------------
// Executive Table
// ---------------------------------------------------------------------------

test("Executive Table: one row per officer, priority sourced from OfficerIntelligenceCard, nextAction from documentIntelligence", () => {
  const officer = fakeOfficer("a", {
    documentIntelligence: composeOfficerDocumentIntelligence({ officerId: "a", officerPk: 1, documents: [], asOf: ASOF }),
  });
  const dataset = datasetFrom([officer]);
  const dashboard = dashboardFrom([officer], { a: "high" });
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.equal(center.executiveTable.length, 1);
  const row = center.executiveTable[0];
  assert.equal(row.officerId, "a");
  assert.equal(row.priority, "high");
  assert.equal(row.nextActionTh, officer.documentIntelligence.primaryActionLabelTh);
  assert.equal(row.href, "/officers/a");
});

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

test("Executive Summary: all-zero dataset produces the honest empty state, not fabricated bullets", () => {
  const dataset = datasetFrom([]);
  const dashboard = dashboardFrom([], {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.equal(center.executiveSummary.urgentOfficerCount, 0);
  assert.deepEqual(center.executiveSummary.bulletsTh, []);
  // Deterministic zero wording — UI swaps to cic.summary.empty when both are zero.
  assert.equal(center.executiveSummary.headlineTh, "วันนี้มีกำลังพลที่ควรดำเนินการเร่งด่วน 0 นาย");
});

test("Executive Summary: bullets only include non-zero categories, each a real Thai count sentence", () => {
  const officers = [fakeOfficer("a"), fakeOfficer("b")];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, { a: "critical" });
  const viewModel = emptyViewModel({
    promotion: { ...emptyViewModel().promotion, eligibleThisYear: 6 },
    retirement: { ...emptyViewModel().retirement, withinOneYear: 2 },
    training: { ...emptyViewModel().training, missingRequiredCount: 3 },
  });

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  assert.ok(center.executiveSummary.bulletsTh.includes("ครบคุณสมบัติเลื่อนตำแหน่ง 6 นาย"));
  assert.ok(center.executiveSummary.bulletsTh.includes("ใกล้เกษียณ 2 นาย"));
  assert.ok(center.executiveSummary.bulletsTh.includes("ขาดการฝึกอบรม 3 นาย"));
  assert.ok(!center.executiveSummary.bulletsTh.some((b) => b.includes("เอกสารหมดอายุ")), "no expired documents in this fixture");
  assert.match(center.executiveSummary.headlineTh, /^วันนี้มีกำลังพลที่ควรดำเนินการเร่งด่วน \d+ นาย$/);
});

// ---------------------------------------------------------------------------
// No fabricated / sensitive data leakage
// ---------------------------------------------------------------------------

test("composed view model never includes nationalId / fingerprint / raw OCR text", () => {
  const officers = [fakeOfficer("a")];
  const dataset = datasetFrom(officers);
  const dashboard = dashboardFrom(officers, {});
  const viewModel = emptyViewModel();

  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const blob = JSON.stringify(center);
  assert.equal(blob.includes("nationalId"), false);
  assert.equal(blob.includes("fingerprint"), false);
  assert.equal(blob.includes("ocrRawText"), false);
});
