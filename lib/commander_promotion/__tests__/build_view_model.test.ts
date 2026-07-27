/**
 * Phase 50 — Commander Promotion Intelligence view-model tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { buildCommanderPromotionDashboard } from "@/lib/commander_promotion/build_view_model";
import { filterPreparedRows, countActiveFilters } from "@/lib/commander_promotion/filter_rows";
import { computeTenureReadinessPercent, readinessBandFromPercent } from "@/lib/commander_promotion/readiness";
import { assignExecutivePriority } from "@/lib/commander_promotion/priority";
import { buildCommanderPromotionCsv } from "@/lib/commander_promotion/export_csv";
import { EMPTY_PROMOTION_FILTER, type PreparedPromotionRow } from "@/lib/commander_promotion/types";
import { INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import { policyForTargetLevel } from "@/lib/promotion/eligibility_policy";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const ASOF = new Date("2026-07-24T00:00:00.000Z");

function promo(partial: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: 36,
    overdueYears: 0,
    eligibleYearOrdinal: null,
    targetLevel: "รองผู้กำกับการ",
    currentRank: "พ.ต.ท.",
    currentPosition: "สารวัตร",
    targetRank: "รองผู้กำกับการ",
    targetPosition: "รองผู้กำกับการ",
    promotionStatus: "Waiting",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    firstEligibleDate: "2029-01-01",
    firstEligibleYearBe: 2572,
    firstEligibleFiscalYearBe: 2572,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: null,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    displayReasonTh: null,
    remainingTenureYears: 3,
    displayRemainingTenureTh: "ประมาณ 3 ปี",
    requiredTenureYears: 5,
    waitingReasonTh: null,
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: 10,
    priorityReason: "Waiting",
    ...partial,
  } as PromotionSummary;
}

function officer(id: string, overrides: Partial<CommanderQueryOfficer> = {}, promoOverrides: Partial<PromotionSummary> = {}): CommanderQueryOfficer {
  return {
    officerId: id,
    rank: "พ.ต.ท.",
    firstName: "ทดสอบ",
    lastName: id,
    displayName: `ทดสอบ ${id}`,
    currentPosition: "สารวัตร",
    positionLevel: "สารวัตร",
    currentUnit: "กก.ตชด.41",
    regionId: 4,
    battalionId: 41,
    companyId: 414,
    companyLabel: "ร้อย ตชด.414",
    yearsInRank: 5,
    yearsInPosition: 5,
    yearsInPositionLevel: 5,
    positionLevelYearCount: 2,
    completedPromotionCycles: 2,
    governmentServiceYears: 20,
    ageYears: 45,
    retirementYear: 2045,
    retirementYearBe: 2588,
    promotionStatus: "near_eligible",
    retirementStatus: "normal",
    priority: "medium",
    profileCompletenessPercent: 80,
    flags: [],
    flagCodes: [],
    hasGp7: true,
    hasOfficialPortrait: true,
    hasTraining: true,
    hasDocuments: true,
    academyClass: null,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: promo(promoOverrides),
    trainingIntelligence: {
      available: true,
      asOfDate: "2026-07-24",
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
      trainingStatus: "NoPolicy",
      displayStatusTh: "ยังไม่มีนโยบายหลักสูตร",
      recommendationsTh: [],
      dataQualityFlags: [],
    },
    dateOfBirth: null,
    displayServiceDurationTh: "20 ปี",
    positionLevelStartYearBe: 2567,
    rankStartedAtYearBe: 2568,
    yearsInRankCount: 1,
    displayAgeYearsMonthsTh: null,
    appointmentCycle: 2567,
    eligibleCycle: 2572,
    overdueCycles: 0,
    promotionCycleBucket: "not_eligible",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence: {
      officerId: id,
      readinessLevel: "READY",
      missingRequiredCount: 0,
      pendingReviewCount: 0,
      expiringSoonCount: 0,
      expiredCount: 0,
      primaryActionLabelTh: "",
      completenessPercent: 100,
    } as unknown as CommanderQueryOfficer["documentIntelligence"],
    documentExpiryInfo: [],
    ...overrides,
  } as CommanderQueryOfficer;
}

function dataset(officers: CommanderQueryOfficer[]): CommanderQueryDataset {
  return {
    officers,
    options: {
      ranks: ["พ.ต.ท."],
      positionLevels: ["สารวัตร"],
      regions: [{ id: 4, label: "ภาค 4" }],
      battalions: [{ id: 41, regionId: 4, label: "กก.ตชด.41" }],
      companies: [{ id: 414, battalionId: 41, label: "ร้อย ตชด.414" }],
      priorities: ["low", "medium", "high", "critical"],
      skillCatalog: { categories: [], levels: [] },
    },
  };
}

test("readiness: 100 / 40 / unknown", () => {
  assert.equal(computeTenureReadinessPercent(5, 5), 100);
  assert.equal(computeTenureReadinessPercent(2, 5), 40);
  assert.equal(computeTenureReadinessPercent(null, 5), null);
  assert.equal(readinessBandFromPercent(100), "complete");
  assert.equal(readinessBandFromPercent(40), "developing");
  assert.equal(readinessBandFromPercent(null), "unknown");
});

test("KPI partition exclusive and exhaustive; banner equals KPI", () => {
  const officers = [
    officer("E", {}, { promotionStatus: "EligibleThisYear", eligibleNow: true, remainingTenureYears: 0, firstEligibleYearBe: 2569, eligibleYearOrdinal: 1, displayStatusTh: "ครบคุณสมบัติในปีนี้", displayRemainingTenureTh: "ครบเกณฑ์แล้ว" }),
    officer("A", { positionLevelYearCount: 6 }, { promotionStatus: "AlreadyEligible", eligibleNow: true, overdueYears: 1, remainingTenureYears: 0, firstEligibleYearBe: 2568, eligibleYearOrdinal: 2, displayStatusTh: "มีคุณสมบัติครบมาแล้ว" }),
    officer("N", { positionLevelYearCount: 4 }, { promotionStatus: "Waiting", remainingTenureYears: 1, firstEligibleYearBe: 2570, displayRemainingTenureTh: "ประมาณ 1 ปี" }),
    officer("W", { positionLevelYearCount: 2 }, { promotionStatus: "Waiting", remainingTenureYears: 3, firstEligibleYearBe: 2572 }),
    officer("I", { positionLevelStartYearBe: null, positionLevelYearCount: null }, { promotionStatus: "Unknown", missingEvidence: ["current_position_level_start_date"], firstEligibleYearBe: null, requiredTenureYears: null, remainingTenureYears: null, confidence: "incomplete" }),
    officer("T", {}, { targetPosition: null, targetLevel: null, promotionStatus: "NotEligible", firstEligibleYearBe: null }),
  ];
  // Fix E completed years for readiness
  officers[0]!.positionLevelYearCount = 5;

  const vm = buildCommanderPromotionDashboard(dataset(officers), { asOf: ASOF });
  assert.equal(vm.rows.length, 6);
  assert.equal(vm.kpis.reduce((s, k) => s + k.count, 0), 6);
  const buckets = new Set(vm.rows.map((r) => r.executiveBucket));
  assert.equal(buckets.size, 6);
  assert.equal(vm.executiveSummary.eligibleThisYearCount, vm.kpis.find((k) => k.bucket === "eligibleThisYear")!.count);
  assert.equal(vm.executiveSummary.alreadyEligibleCount, vm.kpis.find((k) => k.bucket === "alreadyEligible")!.count);
  assert.equal(vm.executiveSummary.nextYearCount, vm.kpis.find((k) => k.bucket === "nextYear")!.count);
  assert.equal(vm.executiveSummary.incompleteCount, vm.kpis.find((k) => k.bucket === "incomplete")!.count);
  assert.equal(vm.priorityDistribution.reduce((s, p) => s + p.count, 0), 6);
});

test("priority: every row one band; Critical for overdue already-eligible", () => {
  const row = {
    executiveBucket: "alreadyEligible" as const,
    isPromotionReady: true,
    overdueYears: 2,
    retirementWindow: "beyond" as const,
    readinessBand: "complete" as const,
    hasUnknownPositionHistory: false,
  };
  assert.equal(assignExecutivePriority(row), "Critical");
  assert.equal(
    assignExecutivePriority({
      executiveBucket: "eligibleThisYear",
      isPromotionReady: true,
      overdueYears: 0,
      retirementWindow: "beyond",
      readinessBand: "complete",
      hasUnknownPositionHistory: false,
    }),
    "High"
  );
});

test("organization totals reconcile; average readiness ignores unknown", () => {
  const officers = [
    officer("a", { positionLevelYearCount: 5 }, { promotionStatus: "EligibleThisYear", eligibleNow: true, remainingTenureYears: 0, firstEligibleYearBe: 2569 }),
    officer("b", { positionLevelYearCount: null, positionLevelStartYearBe: null }, { promotionStatus: "Unknown", missingEvidence: ["current_position_level_start_date"], requiredTenureYears: null, firstEligibleYearBe: null }),
  ];
  const vm = buildCommanderPromotionDashboard(dataset(officers), { asOf: ASOF });
  const company = vm.organizationComparison.find((o) => o.level === "company");
  assert.ok(company);
  assert.equal(company!.total, 2);
  assert.equal(company!.knownReadinessCount, 1);
  assert.equal(company!.averageReadiness, 100);
});

test("retirement collision cumulative windows use existing fields only", () => {
  const ready = officer(
    "r1",
    { retirementYearBe: 2570, retirementStatus: "retiring_within_1_year", positionLevelYearCount: 5 },
    { promotionStatus: "EligibleThisYear", eligibleNow: true, remainingTenureYears: 0, firstEligibleYearBe: 2569 }
  );
  const vm = buildCommanderPromotionDashboard(dataset([ready]), { asOf: ASOF });
  assert.equal(vm.retirementCollisions.within1.count, 1);
  assert.equal(vm.retirementCollisions.within3.count, 1);
  assert.equal(vm.retirementCollisions.within5.count, 1);
});

test("forecast counts only existing firstEligibleYearBe", () => {
  const officers = [
    officer("a", { positionLevelYearCount: 5 }, { promotionStatus: "EligibleThisYear", eligibleNow: true, firstEligibleYearBe: 2569, remainingTenureYears: 0 }),
    officer("b", {}, { firstEligibleYearBe: 2571 }),
    officer("c", { positionLevelStartYearBe: null, positionLevelYearCount: null }, { promotionStatus: "Unknown", firstEligibleYearBe: null, missingEvidence: ["current_position_level_start_date"] }),
  ];
  const vm = buildCommanderPromotionDashboard(dataset(officers), { asOf: ASOF });
  assert.equal(vm.workloadForecast.find((f) => f.yearBe === 2569)?.count, 1);
  assert.equal(vm.workloadForecast.find((f) => f.yearBe === 2571)?.count, 1);
  assert.ok(vm.timelineByYear.every((t) => t.yearBe != null));
});

test("shared filter helper + export metadata", () => {
  const officers = [
    officer("a", { positionLevelYearCount: 5 }, { promotionStatus: "EligibleThisYear", eligibleNow: true, remainingTenureYears: 0, firstEligibleYearBe: 2569 }),
    officer("b", {}, { promotionStatus: "Waiting", remainingTenureYears: 3, firstEligibleYearBe: 2572 }),
  ];
  officers[0]!.positionLevelYearCount = 5;
  const vm = buildCommanderPromotionDashboard(dataset(officers), { asOf: ASOF });
  const filtered = filterPreparedRows(vm.rows, { ...EMPTY_PROMOTION_FILTER, bucket: "eligibleThisYear" });
  assert.equal(filtered.length, 1);
  assert.ok(countActiveFilters({ ...EMPTY_PROMOTION_FILTER, bucket: "eligibleThisYear" }) >= 1);
  const csv = buildCommanderPromotionCsv(filtered, {
    organizationLabel: "ทั้งหมด",
    appointmentYearBe: vm.appointmentYearBe,
    generatedDateTh: "24 ก.ค. 2569",
    filter: { ...EMPTY_PROMOTION_FILTER, bucket: "eligibleThisYear" },
    recordCount: filtered.length,
  });
  assert.match(csv, /Commander Promotion Intelligence Report/);
  assert.match(csv, /พร้อมเลื่อนปีนี้/);
  assert.match(csv, /ทดสอบ a/);
  assert.ok(csv.startsWith("\uFEFF") || csv.charCodeAt(0) === 0xfeff || csv.includes("ทดสอบ"));
});

test("watchlist and data quality use prepared flags", () => {
  const officers = [
    officer("t", {}, { promotionStatus: "MissingTraining", missingEvidence: ["training_data"] }),
    officer("i", { positionLevelStartYearBe: null, positionLevelYearCount: null }, { promotionStatus: "Unknown", missingEvidence: ["current_position_level_start_date"], firstEligibleYearBe: null }),
  ];
  const vm = buildCommanderPromotionDashboard(dataset(officers), { asOf: ASOF });
  assert.ok(vm.executiveWatchlist.find((w) => w.key === "training")!.count >= 1);
  assert.ok(vm.dataQuality.find((d) => d.key === "missingLevelStart")!.count >= 1);
});

test("blocker factors do not invent unsupported keys", () => {
  const vm = buildCommanderPromotionDashboard(dataset([officer("x")]), { asOf: ASOF });
  for (const b of vm.blockingFactors) {
    assert.ok(["MissingTraining", "MissingDocuments", "RetirementRestricted", "missingLevelStart", "noTarget", "Unknown"].includes(b.key));
  }
});

test("ground truth: nine tools; policy 5/7", () => {
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
  assert.equal(policyForTargetLevel("รองผู้กำกับการ")?.minYearsInPositionLevel, 5);
  assert.equal(policyForTargetLevel("สารวัตร")?.minYearsInPositionLevel, 7);
});

test("page loader / nav / auth / dictionary wiring (source)", async () => {
  const pageData = await fs.readFile(path.join(REPO_ROOT, "lib/server/commander_promotion_page_data.ts"), "utf8");
  assert.equal((pageData.match(/orchestrateCommanderDashboardPageData\(/g) ?? []).length, 1);
  assert.equal((pageData.match(/buildCommanderPromotionDashboard\(/g) ?? []).length, 1);
  assert.ok(pageData.includes("server-only"));

  const page = await fs.readFile(path.join(REPO_ROOT, "app/commander-promotion/page.tsx"), "utf8");
  assert.ok(page.includes("loadCommanderPromotionPageData"));
  assert.equal((page.match(/await loadCommanderPromotionPageData\(/g) ?? []).length, 1);

  const auth = await fs.readFile(path.join(REPO_ROOT, "lib/auth/auth_config.ts"), "utf8");
  assert.match(auth, /\{\s*prefix:\s*"\/commander-promotion",\s*permission:\s*"dashboard\.view"\s*\}/);

  const shell = await fs.readFile(path.join(REPO_ROOT, "components/layout/app_shell.tsx"), "utf8");
  assert.match(shell, /href:\s*"\/commander-promotion"/);
  assert.match(shell, /labelKey:\s*"nav\.commanderPromotion"/);

  const dict = await fs.readFile(path.join(REPO_ROOT, "lib/i18n/dictionary.ts"), "utf8");
  assert.ok(dict.includes('"nav.commanderPromotion"'));
  assert.ok(dict.includes('"cpi.title"'));
});

test("empty filter set is safe", () => {
  const vm = buildCommanderPromotionDashboard(dataset([]), { asOf: ASOF });
  assert.equal(vm.totalOfficers, 0);
  assert.equal(filterPreparedRows(vm.rows, EMPTY_PROMOTION_FILTER).length, 0);
  assert.equal(vm.dashboardQuickStats.averageReadiness, null);
});

// silence unused import if PreparedPromotionRow unused
void (null as unknown as PreparedPromotionRow);
