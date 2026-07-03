/**
 * Phase 11B — Data Quality Intelligence runner.
 *
 * Read-only analysis over the exported personnel records. Reuses the Phase 11A
 * KnowledgeBuilder / FilesystemExportSource (unchanged) to build the knowledge
 * base and to obtain each officer's raw extraction, then runs the QualityEngine
 * and writes quality_report.json + logs/quality_summary.json. Modifies no
 * extracted data; no OpenAI, OCR, Google Drive, or database.
 *
 * Usage:
 *   npx tsx scripts/run_quality_analysis.ts
 */

import fs from "node:fs";
import path from "node:path";

import { FilesystemExportSource, KnowledgeBuilder } from "@/lib/knowledge/knowledge_builder";
import { buildIndexes } from "@/lib/knowledge/knowledge_index";
import type { KnowledgeBase, KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import type { PersonnelExtraction } from "@/lib/types/vision";
import { QualityEngine, type OfficerRecord } from "@/lib/quality/quality_engine";
import { analyzeQuality, writeQualityArtifacts, type QualityWriter } from "@/lib/quality/quality_report";

const EXPORTS_DIR = path.join(process.cwd(), "exports");
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const LOGS_DIR = path.join(process.cwd(), "logs");

class FilesystemQualityWriter implements QualityWriter {
  constructor(private readonly dir: string) {}
  write(filename: string, data: unknown): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, filename), JSON.stringify(data, null, 2));
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Pairs each KnowledgeOfficer with its raw extraction. The builder derives an
 * officer id from region + source file; we recompute the same id from the raw
 * export so the pairing is exact, and build the officer set through the same
 * builder so nothing is re-derived inconsistently.
 */
function loadRecordsAndBase(): { records: OfficerRecord[]; base: KnowledgeBase } {
  const source = new FilesystemExportSource(EXPORTS_DIR);
  const base = new KnowledgeBuilder({ source }).build();

  const officerById = new Map<string, KnowledgeOfficer>();
  for (const officer of base.officers) officerById.set(officer.identity.id, officer);

  const records: OfficerRecord[] = [];
  for (const raw of source.read()) {
    const extraction: PersonnelExtraction | undefined =
      raw.data.normalized_extraction ?? raw.data.original_extraction;
    if (!extraction) continue;

    const region = raw.data.region ?? raw.key.split(/[\\/]/)[0] ?? "";
    const sourceFile = raw.data.source_file ?? path.basename(raw.key);
    const id = region ? `${region}/${sourceFile.replace(/\.[^.]+$/, "")}` : sourceFile.replace(/\.[^.]+$/, "");

    const officer = officerById.get(id);
    if (officer) records.push({ officer, extraction });
  }

  // Rebuild indexes over exactly the paired officers (defensive; same set).
  return { records, base: { officers: base.officers, indexes: buildIndexes(base.officers) } };
}

function main(): void {
  const { records, base } = loadRecordsAndBase();

  const result = analyzeQuality(records, base, new QualityEngine());

  const writer = new FilesystemQualityWriter(KNOWLEDGE_DIR);
  writeQualityArtifacts(result, writer);
  writeJson(path.join(LOGS_DIR, "quality_summary.json"), result.summary);

  console.log("Data Quality Analysis (read-only)");
  console.log(`Officers analyzed: ${result.report.officers.length}`);
  console.log("");
  console.log("Summary:");
  console.log(JSON.stringify(result.summary, null, 2));
  console.log("");
  console.log("Top failure reasons:");
  console.log(JSON.stringify(result.topFailureReasons.slice(0, 8), null, 2));
  console.log("");
  console.log("Recommendation summary:");
  console.log(JSON.stringify(result.recommendationSummary, null, 2));
  console.log("");
  console.log(`Wrote knowledge/quality_report.json, knowledge/quality_summary.json, and ${path.relative(process.cwd(), path.join(LOGS_DIR, "quality_summary.json"))}`);
}

main();
