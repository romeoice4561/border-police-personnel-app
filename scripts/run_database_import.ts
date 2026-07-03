/**
 * Phase 12 — Database Import runner.
 *
 * Persists the exported personnel data into PostgreSQL, idempotently. Reuses
 * the Phase 11A Knowledge Layer (to build officers from exports/) and the
 * Phase 11B Quality Layer (for per-officer quality scores), then runs the
 * DatabaseImporter through the repository layer. No AI pipeline code is
 * touched; no OpenAI/OCR/Google Drive.
 *
 * Requires DATABASE_URL (a PostgreSQL/Supabase connection string) in
 * .env.local. Exits with a readable message if it is not configured, rather
 * than failing obscurely.
 *
 * Usage:
 *   npx prisma migrate dev      # once, to create the schema
 *   npx tsx scripts/run_database_import.ts
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

import { FilesystemExportSource, KnowledgeBuilder } from "@/lib/knowledge/knowledge_builder";
import { QualityEngine, type OfficerRecord } from "@/lib/quality/quality_engine";
import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import type { PersonnelExtraction } from "@/lib/types/vision";
import { createDatabaseClient, DatabaseConfigError } from "@/lib/database/database";
import { DatabaseImporter, type ImportableOfficer } from "@/lib/database/database_importer";
import type { DatabaseClient } from "@/lib/database/database_types";

const EXPORTS_DIR = path.join(process.cwd(), "exports");
const LOGS_DIR = path.join(process.cwd(), "logs");

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** Builds the officers + their quality scores from exports/ (reusing the knowledge + quality layers). */
function buildImportableOfficers(): ImportableOfficer[] {
  const source = new FilesystemExportSource(EXPORTS_DIR);
  const base = new KnowledgeBuilder({ source }).build();

  const byId = new Map<string, KnowledgeOfficer>(base.officers.map((o) => [o.identity.id, o]));

  const records: OfficerRecord[] = [];
  for (const raw of source.read()) {
    const extraction: PersonnelExtraction | undefined =
      raw.data.normalized_extraction ?? raw.data.original_extraction;
    if (!extraction) continue;
    const region = raw.data.region ?? raw.key.split(/[\\/]/)[0] ?? "";
    const file = raw.data.source_file ?? path.basename(raw.key);
    const id = region ? `${region}/${file.replace(/\.[^.]+$/, "")}` : file.replace(/\.[^.]+$/, "");
    const officer = byId.get(id);
    if (officer) records.push({ officer, extraction });
  }

  const quality = new QualityEngine().analyze(records, base);
  const scoreById = new Map(quality.officers.map((q) => [q.officer_id, q.quality_score]));

  return base.officers.map((officer) => ({
    officer,
    qualityScore: scoreById.get(officer.identity.id) ?? null,
  }));
}

async function main(): Promise<void> {
  let client: DatabaseClient;
  try {
    client = createDatabaseClient() as unknown as DatabaseClient;
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const officers = buildImportableOfficers();
  console.log(`Importing ${officers.length} officer(s) from exports/ into the database...`);

  const importer = new DatabaseImporter({ client });
  const summary = await importer.import(officers);

  writeJson(path.join(LOGS_DIR, "database_import_summary.json"), summary);

  console.log("Completed");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Summary saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "database_import_summary.json"))}`);

  // Release the connection pool.
  await (client as unknown as { $disconnect?: () => Promise<void> }).$disconnect?.();
}

main().catch((error) => {
  console.error("Database import runner crashed:", error);
  process.exitCode = 1;
});
