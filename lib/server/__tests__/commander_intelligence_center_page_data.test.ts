/**
 * Phase 49B — Commander Intelligence Center page orchestration.
 *
 * Proves the page composes on top of the SAME single officer-profile load +
 * single CommanderQueryDataset build Commander Dashboard already performs —
 * no second fetch, no duplicate dataset build.
 *
 * lib/server/commander_intelligence_center_page_data.ts itself imports
 * "server-only" (a real dependency this repo does not install for the test
 * runner — see lib/server/__tests__' existing convention of testing the
 * underlying `server-only`-free orchestrator/composer directly instead of
 * the thin `lib/server/*_page_data.ts` wrapper). This test exercises the
 * exact same call sequence the wrapper performs (orchestrate then compose)
 * using only `server-only`-free modules.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { orchestrateCommanderDashboardPageData } from "@/lib/commander_dashboard/orchestrate_page_data";
import { buildCommanderIntelligenceCenter } from "@/lib/commander_intelligence_center/build_view_model";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import { EMPTY_ORG_TREE } from "@/lib/organization/org_tree";
import type { OfficerWithRelations } from "@/lib/database/query_types";

const ASOF = new Date("2026-07-23T00:00:00.000Z");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const EMPTY_CATALOG = { categories: [], levels: [] };

test("Commander Intelligence Center composes over one orchestrated profile load (matching lib/server/commander_intelligence_center_page_data.ts's call sequence)", async () => {
  let profileLoads = 0;
  let portraitCalls = 0;

  const { dataset, dashboard, viewModel } = await orchestrateCommanderDashboardPageData({
    asOf: ASOF,
    loadOfficerProfiles: async () => {
      profileLoads += 1;
      return [] as OfficerWithRelations[];
    },
    loadOrganizationEngine: async () => organizationEngineFromTree(EMPTY_ORG_TREE),
    getSkillCatalog: async () => EMPTY_CATALOG,
    resolvePortraits: async () => {
      portraitCalls += 1;
      return new Map();
    },
  });
  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });

  assert.equal(profileLoads, 1, "loadOfficerProfiles must run exactly once");
  assert.equal(portraitCalls, 1, "portrait batch resolve must run exactly once");
  assert.equal(dataset.officers.length, 0);
  assert.equal(center.executiveTable.length, 0);
  assert.equal(center.priorityMatrix.length, 4, "all four priority buckets always present");
  assert.deepEqual(center.executiveSummary.bulletsTh, []);
});

test("lib/server/commander_intelligence_center_page_data.ts's wrapper delegates to orchestrateCommanderDashboardPageData + buildCommanderIntelligenceCenter exactly once each (source-level check, since the module itself needs the real 'server-only' package to import at runtime)", async () => {
  const source = await fs.readFile(
    path.join(REPO_ROOT, "lib/server/commander_intelligence_center_page_data.ts"),
    "utf8"
  );
  assert.ok(source.includes('import "server-only"'));
  assert.equal((source.match(/orchestrateCommanderDashboardPageData\(/g) ?? []).length, 1);
  assert.equal((source.match(/buildCommanderIntelligenceCenter\(/g) ?? []).length, 1);
  assert.ok(!source.includes("getCommanderQueryDataset"));
  assert.ok(!source.includes('from "@/lib/commander_query/build_dataset"'), "must not import the dataset builder directly — it only reuses the already-built dataset");
});

test("app/commander-intelligence/page.tsx owns a single loadCommanderIntelligenceCenterPageData call, no second dataset/dashboard fetch", async () => {
  const pageSource = await fs.readFile(path.join(REPO_ROOT, "app/commander-intelligence/page.tsx"), "utf8");
  assert.ok(pageSource.includes("loadCommanderIntelligenceCenterPageData"));
  assert.equal((pageSource.match(/await loadCommanderIntelligenceCenterPageData\(/g) ?? []).length, 1);
  assert.ok(!pageSource.includes("getCommanderQueryDataset"));
  assert.ok(!pageSource.includes("loadCommanderDashboardPageData"));
  assert.ok(!pageSource.includes("Promise.all"));
});

test("Commander Intelligence Center route is registered with a real permission (no unguarded route)", async () => {
  const authConfigSource = await fs.readFile(path.join(REPO_ROOT, "lib/auth/auth_config.ts"), "utf8");
  assert.match(authConfigSource, /\{\s*prefix:\s*"\/commander-intelligence",\s*permission:\s*"dashboard\.view"\s*\}/);
});

test("sidebar nav declares the Commander Intelligence Center item", async () => {
  const shellSource = await fs.readFile(path.join(REPO_ROOT, "components/layout/app_shell.tsx"), "utf8");
  assert.match(shellSource, /href:\s*"\/commander-intelligence"/);
  assert.match(shellSource, /labelKey:\s*"nav\.commanderIntelligence"/);
});
