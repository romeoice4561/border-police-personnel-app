/**
 * Phase 52.2 — Commander Workforce UI architecture + presentation tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { composeCommanderWorkforceViewModel } from "@/lib/commander_workforce/compose";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";

const REPO = process.cwd();
const ASOF = new Date("2026-07-17T00:00:00.000Z");

function fakePromo(overrides: Partial<PromotionSummary> = {}): PromotionSummary {
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
    firstEligibleYearBe: null,
    firstEligibleFiscalYearBe: null,
    displayReasonTh: null,
    remainingTenureYears: null,
    displayRemainingTenureTh: null,
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
    displayStatusTh: "ยังไม่มีข้อมูล",
    recommendationsTh: [],
    dataQualityFlags: [],
    ...overrides,
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
    displayName: `ทดสอบ ${id}`,
    currentPosition: "รอง สว.",
    positionLevel: "รองสารวัตร",
    currentUnit: "ร้อย 414",
    regionId: 4,
    battalionId: 41,
    companyId: 414,
    companyLabel: "ร้อย ตชด.414",
    yearsInRank: null,
    yearsInPosition: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
    completedPromotionCycles: null,
    governmentServiceYears: null,
    ageYears: null,
    retirementYear: 2030,
    retirementYearBe: 2573,
    promotionStatus: "not_eligible",
    retirementStatus: "normal",
    priority: "low",
    profileCompletenessPercent: 90,
    flags: [],
    flagCodes: [],
    hasGp7: true,
    hasOfficialPortrait: true,
    hasTraining: false,
    hasDocuments: true,
    academyClass: null,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: fakePromo(),
    trainingIntelligence: fakeTraining(),
    dateOfBirth: new Date("1980-01-01T00:00:00.000Z"),
    displayServiceDurationTh: null,
    positionLevelStartYearBe: 2560,
    rankStartedAtYearBe: 2555,
    yearsInRankCount: 11,
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
    documentExpiryInfo: [],
    ...overrides,
  };
}

describe("page data loading contracts", () => {
  it("primary page loads Workforce data once and does not use old CIC loader", () => {
    const page = readFileSync(path.join(REPO, "app/commander-intelligence/page.tsx"), "utf8");
    assert.ok(page.includes("loadCommanderWorkforcePageData"));
    assert.equal((page.match(/await loadCommanderWorkforcePageData\(/g) ?? []).length, 1);
    assert.ok(!page.includes("loadCommanderIntelligenceCenterPageData"));
    assert.ok(!page.includes("getCommanderQueryDataset"));
    assert.ok(!page.includes("buildCommanderIntelligenceCenter"));
  });

  it("legacy page still uses old CIC loader once", () => {
    const page = readFileSync(
      path.join(REPO, "app/commander-intelligence/legacy/page.tsx"),
      "utf8"
    );
    assert.ok(page.includes("loadCommanderIntelligenceCenterPageData"));
    assert.equal((page.match(/await loadCommanderIntelligenceCenterPageData\(/g) ?? []).length, 1);
    assert.ok(!page.includes("loadCommanderWorkforcePageData"));
  });

  it("sidebar still points at /commander-intelligence without a legacy main-nav item", () => {
    const shell = readFileSync(path.join(REPO, "components/layout/app_shell.tsx"), "utf8");
    assert.match(shell, /href:\s*"\/commander-intelligence"/);
    assert.ok(!shell.includes("/commander-intelligence/legacy"));
  });
});

describe("UI presentation from ViewModel", () => {
  it("unavailable vacancy is not represented as an evaluated zero metric", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [officer("A")],
      asOfDate: ASOF,
      now: ASOF,
    });
    assert.equal(vm.overview.vacancy.availability.status, "unavailable");
    assert.notEqual(vm.overview.vacancy.availability.status, "available");
    // UI contract: MetricCard renders "—" when unavailable; count may be 0 but must not be treated as evaluated.
    const metricCard = readFileSync(
      path.join(REPO, "components/commander-workforce/metric-card.tsx"),
      "utf8"
    );
    assert.ok(metricCard.includes("unavailable"));
    assert.ok(metricCard.includes("—"));
    assert.ok(metricCard.includes("AvailabilityState"));
  });

  it("action center and readiness copy avoid AI / merit-ranking wording", () => {
    const files = [
      "executive-action-center.tsx",
      "readiness-section.tsx",
      "commander-workforce-page.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(path.join(REPO, "components/commander-workforce", file), "utf8");
      assert.ok(!src.includes("AI score"), file);
      assert.ok(!src.includes("คะแนน AI"), file);
      assert.ok(!src.includes("merit ranking"), file);
      assert.ok(!src.toLowerCase().includes("chatgpt"), file);
      assert.ok(!src.includes("computePromotionSummary"));
      assert.ok(!src.includes("computeRetirementSummary"));
    }
  });

  it("promotion section renders all canonical statuses from ViewModel", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [officer("A", { promotionIntelligence: fakePromo({ promotionStatus: "EligibleThisYear" }) })],
      asOfDate: ASOF,
      now: ASOF,
    });
    assert.equal(vm.promotion.byStatus.length, 8);
    const promoUi = readFileSync(
      path.join(REPO, "components/commander-workforce/promotion-section.tsx"),
      "utf8"
    );
    assert.ok(promoUi.includes("promotion.byStatus.map"));
    assert.ok(promoUi.includes("/commander-promotion"));
  });
});

describe("static import boundaries", () => {
  it("workforce UI does not import engines, prisma, telegram, or search gateway", () => {
    const dir = path.join(REPO, "components", "commander-workforce");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
    const forbidden = [
      "@prisma",
      "createDatabaseClient",
      "computePromotionSummary",
      "computeRetirementSummary",
      "personnel_search_telegram",
      "personnel_search_gateway",
      "getCommanderQueryDataset",
      "loadCommanderIntelligenceCenterPageData",
      "from \"@/lib/promotion/",
      "from '@/lib/promotion/",
    ];
    for (const file of files) {
      if (file.endsWith(".test.ts")) continue;
      const src = readFileSync(path.join(dir, file), "utf8");
      for (const needle of forbidden) {
        assert.ok(!src.includes(needle), `${file} must not contain ${needle}`);
      }
    }
  });
});
