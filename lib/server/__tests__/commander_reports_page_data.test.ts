/**
 * Phase 49C — Executive Report Center page orchestration / route registration.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

test("commander_reports_page_data.ts delegates to loadCommanderIntelligenceCenterPageData exactly once", async () => {
  const source = await fs.readFile(path.join(REPO_ROOT, "lib/server/commander_reports_page_data.ts"), "utf8");
  assert.ok(source.includes('import "server-only"'));
  assert.equal((source.match(/return loadCommanderIntelligenceCenterPageData\(/g) ?? []).length, 1);
  assert.ok(!source.includes("getCommanderQueryDataset"));
  assert.ok(!source.includes("orchestrateCommanderDashboardPageData"));
  assert.ok(!source.includes('from "@/lib/commander_query/build_dataset"'));
});

test("app/commander-reports/page.tsx owns a single loadCommanderReportsPageData call", async () => {
  const pageSource = await fs.readFile(path.join(REPO_ROOT, "app/commander-reports/page.tsx"), "utf8");
  assert.ok(pageSource.includes("loadCommanderReportsPageData"));
  assert.equal((pageSource.match(/await loadCommanderReportsPageData\(/g) ?? []).length, 1);
  assert.ok(!pageSource.includes("getCommanderQueryDataset"));
  assert.ok(!pageSource.includes("loadCommanderOfficerProfiles"));
});

test("Commander Reports route is registered with dashboard.view", async () => {
  const authConfigSource = await fs.readFile(path.join(REPO_ROOT, "lib/auth/auth_config.ts"), "utf8");
  assert.match(authConfigSource, /\{\s*prefix:\s*"\/commander-reports",\s*permission:\s*"dashboard\.view"\s*\}/);
});

test("sidebar nav declares the Executive Reports item", async () => {
  const shellSource = await fs.readFile(path.join(REPO_ROOT, "components/layout/app_shell.tsx"), "utf8");
  assert.match(shellSource, /href:\s*"\/commander-reports"/);
  assert.match(shellSource, /labelKey:\s*"nav\.commanderReports"/);
});
