/**
 * Phase 17 — Production JSON → Supabase import runner.
 *
 * Completes the pipeline: reads the OCR pipeline's PersonnelResult export
 * JSON, validates it, imports it into the Supabase/PostgreSQL database through
 * the idempotent Production Import Engine (lib/import/json_importer.ts), prints
 * progress + a summary, and exits 0 on success.
 *
 * Accepts a single export file, a JSON array of export files, or a directory
 * of *.json export files (skipping .skipped.json markers). No OCR, extraction,
 * or schema changes — this is the persistence stage only.
 *
 * Usage:
 *   npx tsx scripts/import_json_to_supabase.ts exports/personnel_result.json
 *   npx tsx scripts/import_json_to_supabase.ts exports/ภาค1/5.json
 *   npx tsx scripts/import_json_to_supabase.ts exports        # a directory
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load env before any DB module reads process.env (Supabase connection).
for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

import { createDatabaseClient, DatabaseConfigError } from "@/lib/database/database";
import type { DatabaseClient } from "@/lib/database/database_types";
import { JsonImporter, looksLikeExportFile } from "@/lib/import/json_importer";
import type { OfficerImportResult } from "@/lib/import/types";

const LOGS_DIR = path.join(process.cwd(), "logs");

/** Reads and JSON-parses a file, returning one or more export objects (array or single). */
function readExportObjects(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** Resolves the input path to a flat list of parsed export objects (file, array-file, or directory). */
function collectInputs(inputPath: string): unknown[] {
  const stat = fs.statSync(inputPath);

  if (stat.isFile()) {
    return readExportObjects(inputPath);
  }

  // Directory: every *.json except classifier skip markers, recursively.
  const objects: unknown[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".json") || entry.name.endsWith(".skipped.json")) continue;
      try {
        for (const obj of readExportObjects(full)) {
          if (looksLikeExportFile(obj)) objects.push(obj);
        }
      } catch {
        // A malformed file must not abort discovery; it will surface as a
        // validation failure if it did parse, or is skipped here if not.
      }
    }
  };
  walk(inputPath);
  return objects;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function printProgress(result: OfficerImportResult, index: number, total: number): void {
  const position = `[${index + 1}/${total}]`;
  if (result.action === "failed") {
    console.log(`${position} ✗ ${result.officerId} — FAILED: ${result.error}`);
  } else {
    console.log(
      `${position} ✓ ${result.officerId} — ${result.action} ` +
        `(timeline: ${result.timelines}, phones: ${result.phones}, +units: ${result.unitsCreated})`
    );
  }
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npx tsx scripts/import_json_to_supabase.ts <file.json | array.json | directory>");
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

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

  console.log("================================================");
  console.log("Production Import Engine — JSON → Supabase");
  console.log("================================================");

  const files = collectInputs(inputPath);
  console.log(`Discovered ${files.length} record(s) in ${inputPath}`);
  console.log("------------------------------------------------");

  const importer = new JsonImporter({ client, onProgress: printProgress });
  const summary = await importer.importBatch(files);

  console.log("------------------------------------------------");
  console.log("Completed");
  console.log(JSON.stringify(summary, null, 2));

  writeJson(path.join(LOGS_DIR, "json_import_summary.json"), summary);
  console.log(`Summary saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "json_import_summary.json"))}`);

  await (client as unknown as { $disconnect?: () => Promise<void> }).$disconnect?.();

  // Exit 0 on a completed run even if some records failed (their failures are
  // in the summary + ImportLog); exit 1 only if EVERYTHING failed, which
  // signals a systemic problem (e.g. DB unreachable).
  if (summary.total > 0 && summary.failed === summary.total) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Import runner crashed:", error);
  process.exitCode = 1;
});
