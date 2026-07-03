/**
 * Phase 11A — Knowledge Builder runner.
 *
 * Reads every exported personnel JSON under exports/, builds the in-memory
 * Knowledge Base (officers + indexes), detects duplicates, and writes the
 * knowledge/ artifacts plus logs/knowledge_summary.json.
 *
 * Read-only knowledge layer: no OpenAI, no OCR, no Google Drive, no database.
 * It only consumes exports/*.json and never modifies them.
 *
 * Usage:
 *   npx tsx scripts/run_knowledge_builder.ts
 */

import fs from "node:fs";
import path from "node:path";

import { KnowledgeBuilder, FilesystemExportSource } from "@/lib/knowledge/knowledge_builder";
import { buildKnowledgeSummary, detectDuplicates } from "@/lib/knowledge/knowledge_statistics";
import { exportKnowledge, FilesystemKnowledgeWriter } from "@/lib/knowledge/knowledge_export";

const EXPORTS_DIR = path.join(process.cwd(), "exports");
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const LOGS_DIR = path.join(process.cwd(), "logs");

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function main(): void {
  const source = new FilesystemExportSource(EXPORTS_DIR);
  const builder = new KnowledgeBuilder({ source });
  const base = builder.build();

  const summary = buildKnowledgeSummary(base);
  const duplicates = detectDuplicates(base);

  const writer = new FilesystemKnowledgeWriter(KNOWLEDGE_DIR);
  exportKnowledge(base, writer);

  // knowledge_summary.json also goes to logs/ per the phase spec.
  writeJson(path.join(LOGS_DIR, "knowledge_summary.json"), summary);
  writer.write("duplicate_report.json", duplicates);

  console.log("Knowledge base built from exports/");
  console.log(`Officers: ${base.officers.length}`);
  console.log(`Units: ${base.indexes.byUnit.size}`);
  console.log(`Ranks: ${base.indexes.byRank.size}`);
  console.log(`Phones: ${base.indexes.byPhone.size}`);
  console.log(`Timeline years: ${base.indexes.byTimelineYear.size}`);
  console.log("");
  console.log("Summary:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("");
  console.log("Duplicates:");
  console.log(
    JSON.stringify(
      {
        duplicate_phones: duplicates.duplicate_phones.length,
        duplicate_officers: duplicates.duplicate_officers.length,
        duplicate_timeline: duplicates.duplicate_timeline.length,
        duplicate_units: duplicates.duplicate_units.length,
      },
      null,
      2
    )
  );
  console.log("");
  console.log(`Wrote knowledge/*.json and ${path.relative(process.cwd(), path.join(LOGS_DIR, "knowledge_summary.json"))}`);
}

main();
