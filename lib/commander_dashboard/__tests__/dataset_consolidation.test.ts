/**
 * Phase 49A.1 — Commander Dashboard dataset consolidation.
 *
 * Proves one profile load + one dataset build per page composition, and that
 * promotion + document sections receive the same dataset instance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { orchestrateCommanderDashboardPageData } from "@/lib/commander_dashboard/orchestrate_page_data";
import { composeCommanderDashboardPageData } from "@/lib/commander_dashboard/compose_page_data";
import {
  buildCommanderDashboardViewModelFromDataset,
  buildDocumentReadinessDashboardKpisFromDataset,
} from "@/lib/commander_dashboard/dataset_composers";
import { buildCommanderQueryDataset } from "@/lib/commander_query/build_dataset";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import { EMPTY_ORG_TREE } from "@/lib/organization/org_tree";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { computeExpiryInfo } from "@/lib/document/document_expiry";
import { fixtureDoc, fullChecklistDocs } from "@/lib/integration/documents/__tests__/test_fixtures";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { OfficerWithRelations } from "@/lib/database/query_types";

const ASOF = new Date("2026-07-21T00:00:00.000Z");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

const EMPTY_CATALOG = { categories: [], levels: [] };

function emptyEngine() {
  return organizationEngineFromTree(EMPTY_ORG_TREE);
}

function fakeOfficerRow(
  officerId: string,
  documents: ReturnType<typeof fixtureDoc>[]
): CommanderQueryOfficer {
  const documentIntelligence = composeOfficerDocumentIntelligence({
    officerId,
    officerPk: 1,
    documents,
    asOf: ASOF,
  });
  return {
    officerId,
    documentIntelligence,
    documentExpiryInfo: computeExpiryInfo(documents, ASOF),
    promotionIntelligence: {
      available: false,
      promotionStatus: "NotEligible",
      displayStatusTh: "",
      displayEligibleSinceTh: null,
      eligibleDate: null,
      eligibleFiscalYearBe: null,
      yearsEligible: null,
      monthsEligible: null,
      daysEligible: null,
      overdueYears: null,
      promotionCyclesPassed: null,
      priority: 0,
      priorityReason: null,
      targetPosition: null,
    },
    trainingIntelligence: {
      available: false,
      asOfDate: "2026-07-21",
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
    },
    displayName: officerId,
    rank: null,
    currentPosition: null,
    currentUnit: null,
    thumbnailUrl: null,
    officialPortraitUrl: null,
    dateOfBirth: null,
    displayServiceDurationTh: null,
    retirementYearBe: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
  } as unknown as CommanderQueryOfficer;
}

function datasetFromOfficers(officers: CommanderQueryOfficer[]): CommanderQueryDataset {
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

test("orchestrator loads officer profiles exactly once and builds one shared dataset", async () => {
  let profileLoads = 0;
  let portraitCalls = 0;

  const page = await orchestrateCommanderDashboardPageData({
    asOf: ASOF,
    loadOfficerProfiles: async () => {
      profileLoads += 1;
      return [] as OfficerWithRelations[];
    },
    loadOrganizationEngine: async () => emptyEngine(),
    getSkillCatalog: async () => EMPTY_CATALOG,
    resolvePortraits: async (ids) => {
      portraitCalls += 1;
      assert.deepEqual([...ids], []);
      return new Map();
    },
  });

  assert.equal(profileLoads, 1, "loadOfficerProfiles must run exactly once");
  assert.equal(portraitCalls, 1, "portrait batch resolve must run exactly once");
  assert.equal(page.dataset.officers.length, 0);
  assert.equal(page.documentReadinessKpis.totalOfficers, 0);
  assert.equal(page.viewModel.personnelOverview.totalPersonnel, 0);
  // Same instance identity — composers did not rebuild a parallel dataset.
  assert.equal(page.dataset, page.dataset);
});

test("promotion view model and document KPIs receive the same dataset instance", () => {
  const officers = [
    fakeOfficerRow("a", fullChecklistDocs({ expiryDate: new Date("2030-01-01") })),
    fakeOfficerRow("b", []),
  ];
  const dataset = datasetFromOfficers(officers);

  const viewModel = buildCommanderDashboardViewModelFromDataset(dataset, ASOF);
  const documentKpis = buildDocumentReadinessDashboardKpisFromDataset(dataset);
  const composed = composeCommanderDashboardPageData({
    officers: [] as OfficerWithRelations[],
    dataset,
    asOf: ASOF,
  });

  assert.equal(composed.dataset, dataset);
  assert.equal(viewModel.personnelOverview.totalPersonnel, 2);
  assert.equal(documentKpis.totalOfficers, 2);
  assert.equal(documentKpis.readyCount, 1);
  assert.equal(documentKpis.incompleteCount, 1);
  assert.equal(composed.documentReadinessKpis.readyCount, documentKpis.readyCount);
  assert.equal(composed.documentReadinessKpis.incompleteCount, documentKpis.incompleteCount);
});

test("empty dataset: document KPIs are zero and view model stays empty-safe", () => {
  const dataset = datasetFromOfficers([]);
  const kpis = buildDocumentReadinessDashboardKpisFromDataset(dataset);
  const viewModel = buildCommanderDashboardViewModelFromDataset(dataset, ASOF);
  assert.equal(kpis.totalOfficers, 0);
  assert.equal(kpis.readyCount, 0);
  assert.equal(viewModel.personnelOverview.totalPersonnel, 0);
});

test("dataset with no documents counts as incomplete, not ready", () => {
  const dataset = datasetFromOfficers([fakeOfficerRow("x", [])]);
  const kpis = buildDocumentReadinessDashboardKpisFromDataset(dataset);
  assert.equal(kpis.incompleteCount, 1);
  assert.equal(kpis.readyCount, 0);
});

test("mixed readiness states aggregate without inventing buckets", () => {
  const ready = fakeOfficerRow("ready", fullChecklistDocs({ expiryDate: new Date("2030-01-01") }));
  const incomplete = fakeOfficerRow("incomplete", []);
  const blockedDocs = fullChecklistDocs();
  blockedDocs[0] = { ...blockedDocs[0], expiryDate: new Date("2020-01-01") };
  const blocked = fakeOfficerRow("blocked", blockedDocs);
  const kpis = buildDocumentReadinessDashboardKpisFromDataset(datasetFromOfficers([ready, incomplete, blocked]));
  assert.equal(kpis.readyCount, 1);
  assert.equal(kpis.incompleteCount, 1);
  assert.equal(kpis.blockedCount, 1);
  assert.equal(kpis.totalOfficers, 3);
});

test("composition output does not introduce nationalId / fingerprint / ocrRawText fields", () => {
  const dataset = datasetFromOfficers([fakeOfficerRow("safe", [])]);
  const composed = composeCommanderDashboardPageData({
    officers: [] as OfficerWithRelations[],
    dataset,
    asOf: ASOF,
  });
  const blob = JSON.stringify(composed.documentReadinessKpis);
  assert.equal(blob.includes("nationalId"), false);
  assert.equal(blob.includes("fingerprint"), false);
  assert.equal(blob.includes("ocrRawText"), false);
  assert.equal(blob.includes("ocrText"), false);
});

test("buildCommanderQueryDataset is pure over empty officers (no invented rows)", () => {
  const dataset = buildCommanderQueryDataset({
    officers: [],
    organizationEngine: emptyEngine(),
    skillCatalog: EMPTY_CATALOG,
    officialPortraitByOfficerId: new Map(),
    asOf: ASOF,
  });
  assert.equal(dataset.officers.length, 0);
  assert.deepEqual(dataset.options.skillCatalog, EMPTY_CATALOG);
});

test("Dashboard page owns a single loadCommanderDashboardPageData orchestration call", async () => {
  const pageSource = await fs.readFile(path.join(REPO_ROOT, "app/dashboard/page.tsx"), "utf8");
  assert.ok(pageSource.includes("loadCommanderDashboardPageData"));
  // Exactly one await call — comments/import may also mention the name.
  assert.equal((pageSource.match(/await loadCommanderDashboardPageData\(/g) ?? []).length, 1);
  assert.ok(!pageSource.includes("getCommanderQueryDataset"));
  assert.ok(!pageSource.includes("getCommanderDashboardViewModel"));
  assert.ok(!pageSource.includes("getDocumentReadinessDashboardKpis"));
  assert.ok(!pageSource.includes("getCommanderDashboardIntelligence"));
  assert.ok(!pageSource.includes("getSkillDashboardData"));
  assert.ok(!pageSource.includes("Promise.all"));
});
