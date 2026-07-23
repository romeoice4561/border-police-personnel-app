import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const TOOLS_DIR = path.resolve(import.meta.dirname, "..");

const FORBIDDEN = [
  "@prisma/client",
  "from \"prisma\"",
  "from '@/lib/db",
  "from \"@/lib/db",
  "openai",
  "googleapis",
  "loadCommanderIntelligenceCenterPageData",
  "orchestrateCommanderDashboardPageData",
  "getCommanderQueryDataset",
  "buildExecutiveReport",
  "buildCommanderBrief",
];

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "__tests__") {
      files.push(...(await listTsFiles(full)));
    } else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

test("static: tool-layer files avoid Prisma/engines/loaders/AI providers", async () => {
  const files = await listTsFiles(TOOLS_DIR);
  assert.ok(files.length >= 10);
  for (const file of files) {
    const src = await fs.readFile(file, "utf8");
    for (const needle of FORBIDDEN) {
      assert.equal(src.includes(needle), false, `${path.basename(file)} contains ${needle}`);
    }
  }
});

test("static: handlers only reference PersonnelIntelligenceService methods", async () => {
  const defs = await fs.readFile(path.join(TOOLS_DIR, "definitions.ts"), "utf8");
  assert.ok(defs.includes("service.getCommanderSummary"));
  assert.ok(defs.includes("service.searchOfficers"));
  assert.ok(defs.includes("service.getOfficerIntelligence"));
  assert.ok(defs.includes("service.getPromotionSummary"));
  assert.ok(defs.includes("service.getRetirementSummary"));
  assert.ok(defs.includes("service.getDocumentSummary"));
  assert.ok(defs.includes("service.getTrainingSummary"));
  assert.ok(defs.includes("service.getExecutiveBrief"));
  assert.ok(defs.includes("service.getReportProjection"));
  assert.equal(defs.includes("prisma"), false);
});
