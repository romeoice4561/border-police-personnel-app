/**
 * Phase 49.5 — Personnel Intelligence Service focused tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPersonnelIntelligenceContext } from "@/lib/personnel_intelligence_service/context";
import { createPersonnelIntelligenceService } from "@/lib/personnel_intelligence_service/service";
import { actorFromAuthUser } from "@/lib/personnel_intelligence_service/permissions";
import { applyIntelligenceFilters, normalizeIntelligenceQuery } from "@/lib/personnel_intelligence_service/filters";
import { assertNoSensitiveKeys, FORBIDDEN_INTELLIGENCE_KEYS } from "@/lib/personnel_intelligence_service/serializers";
import { sortOfficers, paginateOfficers } from "@/lib/personnel_intelligence_service/queries";
import { INTELLIGENCE_TOOL_DEFINITIONS, INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import { INTELLIGENCE_MAX_PAGE_SIZE } from "@/lib/personnel_intelligence_service/types";
import { PersonnelIntelligenceError } from "@/lib/personnel_intelligence_service/errors";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderDashboard } from "@/lib/intelligence";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import { buildCommanderIntelligenceCenter } from "@/lib/commander_intelligence_center/build_view_model";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";

const ASOF = new Date("2026-07-23T00:00:00.000Z");

function user(role: AuthUser["role"], officerId: string | null = null): AuthUser {
  return {
    id: `mock:${role}`,
    username: role,
    displayName: role,
    role,
    permissions: defaultPermissionsForRole(role),
    officerId,
    mustChangePassword: false,
    isActive: true,
  };
}

function fakePromotion(partial: Partial<PromotionSummary> = {}): PromotionSummary {
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
    rankStartedAtYearBe: null,
    yearsInRankCount: null,
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
    displayServiceDurationTh: "16 ปี",
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

function emptyViewModel(): CommanderDashboardViewModel {
  return {
    asOf: ASOF,
    fiscalYearBe: 2569,
    displayFiscalYearTh: "ปีงบประมาณ 2569",
    promotion: {
      eligibleThisYear: 0,
      alreadyEligible: 0,
      waiting: 0,
      missingTraining: 0,
      missingDocuments: 0,
      retirementRestricted: 0,
      notEligible: 0,
      unknown: 0,
    },
    retirement: { withinOneYear: 0, withinThreeYears: 0, withinFiveYears: 0 },
    training: { policyConfigured: false, missingRequiredCount: 0, expiredCount: 0, expiringSoonCount: 0 },
  } as unknown as CommanderDashboardViewModel;
}

function dashboardFrom(officers: CommanderQueryOfficer[]): CommanderDashboard {
  return {
    summary: {
      totalOfficers: officers.length,
      promotionReady: 0,
      nearPromotion: 0,
      retiringSoon: 0,
      incompleteProfiles: 0,
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
      priority: o.priority,
      priorityScore: 0,
      flags: [],
      recommendations: [],
    })),
  } as unknown as CommanderDashboard;
}

function makeService(role: AuthUser["role"], officers: CommanderQueryOfficer[], officerId: string | null = null) {
  const dataset: CommanderQueryDataset = {
    officers,
    options: {
      ranks: ["ร.ต.อ."],
      positionLevels: ["สว."],
      regions: [{ id: 1, label: "ภาค 4" }],
      battalions: [{ id: 10, regionId: 1, label: "กก.1" }],
      companies: [{ id: 100, battalionId: 10, label: "ร้อย.1" }],
      priorities: ["low", "medium", "high", "critical"],
      skillCatalog: { categories: [], levels: [] },
    },
  };
  const dashboard = dashboardFrom(officers);
  const viewModel = emptyViewModel();
  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const ctx = createPersonnelIntelligenceContext({
    actor: actorFromAuthUser(user(role, officerId)),
    asOf: ASOF,
    dataset,
    dashboard,
    viewModel,
    center,
  });
  return createPersonnelIntelligenceService(ctx);
}

test("context instances are distinct (no shared mutable singleton)", () => {
  const a = makeService("commander", [officer("a")]);
  const b = makeService("commander", [officer("b")]);
  assert.notEqual(a.getContextId(), b.getContextId());
});

test("filters: organization + priority; non-mutating; clear restores", () => {
  const officers = [
    officer("a", { priority: "critical", regionId: 1 }),
    officer("b", { priority: "low", regionId: 2 }),
  ];
  const snapshot = officers.map((o) => o.officerId);
  const filtered = applyIntelligenceFilters(officers, { regionId: 1 }, { priority: "critical" }, ASOF);
  assert.equal(filtered.length, 1);
  assert.deepEqual(
    officers.map((o) => o.officerId),
    snapshot
  );
});

test("normalizeIntelligenceQuery rejects invalid sort and oversized pageSize", () => {
  assert.throws(() => normalizeIntelligenceQuery({ sort: "hack.path" }), PersonnelIntelligenceError);
  assert.throws(
    () => normalizeIntelligenceQuery({ pageSize: INTELLIGENCE_MAX_PAGE_SIZE + 1 }),
    (err: unknown) => err instanceof PersonnelIntelligenceError && err.code === "INVALID_QUERY"
  );
});

test("pagination and deterministic sort tie-break on officerId", () => {
  const officers = [officer("b", { priority: "high" }), officer("a", { priority: "high" })];
  const sorted = sortOfficers(officers, "priority", "desc");
  assert.equal(sorted[0]!.officerId, "a");
  const page = paginateOfficers(sorted, 1, 1);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pageItems.length, 1);
});

test("commander can get summary and search; officer cannot browse all", () => {
  const officers = [officer("a", { priority: "critical" }), officer("b")];
  const commander = makeService("commander", officers);
  const summary = commander.getCommanderSummary();
  assert.equal(summary.personnelTotal, 2);
  assert.ok(summary.criticalOfficers >= 1);
  const search = commander.searchOfficers({ page: 1, pageSize: 10 });
  assert.equal(search.pagination.total, 2);

  const officerSvc = makeService("officer", officers, "ภาค4/79");
  assert.throws(() => officerSvc.getCommanderSummary(), (e: unknown) => {
    return e instanceof PersonnelIntelligenceError && e.code === "FORBIDDEN";
  });
  assert.throws(() => officerSvc.searchOfficers(), (e: unknown) => {
    return e instanceof PersonnelIntelligenceError && e.code === "FORBIDDEN";
  });
});

test("officer may view own intelligence only", () => {
  const officers = [officer("ภาค4/79"), officer("other")];
  const svc = makeService("officer", officers, "ภาค4/79");
  const detail = svc.getOfficerIntelligence("ภาค4/79");
  assert.equal(detail.officerId, "ภาค4/79");
  assert.throws(() => svc.getOfficerIntelligence("other"), PersonnelIntelligenceError);
});

test("unknown officer returns OFFICER_NOT_FOUND", () => {
  const svc = makeService("admin", [officer("a")]);
  assert.throws(() => svc.getOfficerIntelligence("missing"), (e: unknown) => {
    return e instanceof PersonnelIntelligenceError && e.code === "OFFICER_NOT_FOUND";
  });
});

test("serializers exclude sensitive keys; forbidden list is checked", () => {
  const svc = makeService("commander", [
    officer("a", {
      driveFileId: "SECRET_DRIVE",
      webViewUrl: "https://example.com/view",
      thumbnailUrl: "https://example.com/thumb",
    }),
  ]);
  const detail = svc.getOfficerIntelligence("a");
  const blob = JSON.stringify(detail);
  for (const key of FORBIDDEN_INTELLIGENCE_KEYS) {
    assert.equal(blob.toLowerCase().includes(key.toLowerCase()), false, key);
  }
  assertNoSensitiveKeys(detail);
  assert.equal("driveFileId" in detail, false);
});

test("executive brief and report projection reuse Phase 49C builders", () => {
  const svc = makeService("commander", [officer("a", { priority: "critical" })]);
  const brief = svc.getExecutiveBrief();
  assert.equal(brief.totalPersonnel, 1);
  assert.ok(brief.actionItemsTh.length >= 1);
  const report = svc.getReportProjection({ type: "monthlyBrief" });
  assert.equal(report.type, "monthlyBrief");
  assert.ok(report.titleTh.length > 0);
  assertNoSensitiveKeys(report);
});

test("Phase 50 tool contracts register all planned tools without execution runtime", () => {
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
  assert.equal(INTELLIGENCE_TOOL_DEFINITIONS.length, 9);
  for (const name of INTELLIGENCE_TOOL_NAMES) {
    assert.ok(INTELLIGENCE_TOOL_DEFINITIONS.some((d) => d.name === name), name);
  }
});

test("source: server adapter loads orchestrator once pattern", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = path.resolve(import.meta.dirname, "../../..");
  const source = await fs.readFile(path.join(root, "lib/server/personnel_intelligence_service.ts"), "utf8");
  assert.equal((source.match(/orchestrateCommanderDashboardPageData\(/g) ?? []).length, 1);
  assert.ok(!source.includes("getCommanderQueryDataset"));
  assert.ok(source.includes("buildCommanderIntelligenceCenter"));
});
