/**
 * Targeted cleanup for CINTEL-DEMO-TRAINING-2569.
 * Default is dry-run. Pass --execute to delete.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database";
import {
  assertDemoWriteAllowed,
  collectDemoCleanupPlan,
  deleteDemoDataset,
  formatCleanupSummary,
  snapshotQaFixtures,
  qaFixturesIntact,
} from "../lib/drug_intelligence/cintel_demo_training_ops";

async function main() {
  const execute = process.argv.includes("--execute");
  const dryRun = process.argv.includes("--dry-run") || !execute;
  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
  if (!connectionString) throw new Error("No DATABASE_URL / DIRECT_URL");

  if (execute && dryRun && process.argv.includes("--dry-run")) {
    throw new Error("Pass either --dry-run or --execute, not both");
  }

  assertDemoWriteAllowed(connectionString);
  const db = createDatabaseClient();
  const plan = await collectDemoCleanupPlan(db);
  console.log(formatCleanupSummary(plan));

  if (!execute) {
    console.log("\nDry-run only. Re-run with --execute to delete this exact dataset.");
    return;
  }
  const before = await snapshotQaFixtures(db);
  await deleteDemoDataset(db, plan);
  const after = await snapshotQaFixtures(db);
  if (!qaFixturesIntact(before, after)) {
    throw new Error("QA fixtures changed during demo cleanup — inspect immediately");
  }
  const remaining = await collectDemoCleanupPlan(db);
  console.log("\nAfter execute:\n" + formatCleanupSummary(remaining));
  console.log("QA fixtures preserved.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
