/**
 * Profile Re-link Dry Run (Phase 21B-2 — SAFE, READ-ONLY INVESTIGATION).
 *
 * Scans the new Google Drive "Profile" folders, runs LOCAL Tesseract OCR on
 * each image (never OpenAI, never the classifier, never the real import
 * pipeline), and scores each image against the 309 existing Officer records
 * using multiple signals together (name, rank, unit, region, phone, timeline
 * units — see lib/import/profile_relink_matcher.ts). Produces a
 * confidence-scored mapping report.
 *
 * GUARANTEES (verified by code, not just intent):
 *   - Zero database writes: only `db.officer.findMany` (read) is called; no
 *     `create`/`update`/`upsert`/`delete` call exists anywhere in this file.
 *   - Never changes `driveFileId` or any other Officer column.
 *   - Never calls OpenAI Vision (no import of lib/ai/*).
 *   - Never invokes the classifier or personnel_image_processor (the real
 *     import pipeline) — only TesseractOCREngine.recognize() is used, purely
 *     to obtain comparable text signals for scoring.
 *   - Every downloaded image's temp file is deleted immediately after OCR.
 *
 * Output: logs/profile_relink_dry_run.json (machine-readable) and a
 * human-readable summary printed to stdout. No other file is written.
 *
 * Usage:
 *   npx tsx scripts/profile_relink_dry_run.ts
 *   npx tsx scripts/profile_relink_dry_run.ts --limit 10   # bounded test run
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const ENV_FILES = [".env.local", ".env"];
for (const envFile of ENV_FILES) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

import { createDriveAuthClient, DriveAuthConfigError } from "@/lib/google-drive/drive_auth";
import { GoogleDriveClient } from "@/lib/google-drive/google_drive_client";
import { FolderScanner } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import { DriveScanReportBuilder, type DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";
import { TesseractOCREngine } from "@/lib/ocr/tesseract_engine";
import {
  scoreOfficerAgainstProfileImage,
  classifyCandidates,
  flagDuplicateCandidates,
  type OfficerSignals,
  type ProfileImageSignals,
  type ProfileImageClassification,
} from "@/lib/import/profile_relink_matcher";

const LOGS_DIR = path.join(process.cwd(), "logs");
const REPORT_PATH = path.join(LOGS_DIR, "profile_relink_dry_run.json");
const TEMP_DIR = path.join(os.tmpdir(), "bppis-relink-dry-run");

function parseLimit(argv: string[]): number {
  const index = argv.indexOf("--limit");
  if (index === -1) return 0;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  console.log("================================================");
  console.log("Phase 21B-2 — Officer Profile Re-link DRY RUN");
  console.log("(read-only: no database writes, no upserts, no driveFileId changes)");
  console.log("================================================\n");

  const limit = parseLimit(process.argv.slice(2));
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER;
  if (!rootFolderId) {
    console.error("GOOGLE_DRIVE_ROOT_FOLDER is not set.");
    process.exitCode = 1;
    return;
  }

  let auth;
  try {
    auth = createDriveAuthClient();
  } catch (error) {
    if (error instanceof DriveAuthConfigError) {
      console.error(`Google Drive authentication is not configured: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const client = new GoogleDriveClient({ auth, supportsSharedDrives: true });
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId });
  const reportBuilder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  console.log("Scanning Google Drive (metadata only)...");
  let scanReport;
  try {
    scanReport = await reportBuilder.build(rootFolderId, { sharedDrive: true });
  } catch (error) {
    if (error instanceof DriveProviderError) {
      console.error(`Google Drive scan failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const profileEntries = scanReport.entries.filter(
    (e) => e.isImage && e.content_type === DriveContentType.Profile
  );
  const selected = limit > 0 ? profileEntries.slice(0, limit) : profileEntries;

  console.log(`Discovered ${scanReport.entries.length} total entries; ${profileEntries.length} Profile image(s).`);
  if (limit > 0) console.log(`--limit ${limit}: processing ${selected.length}.`);
  console.log("");

  // ── Read-only: fetch existing officers + their timeline/phones ──────────
  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();

  console.log("Loading existing officers (read-only)...");
  const officerRows = await db.officer.findMany({
    include: { timeline: true, phones: true },
  });
  console.log(`Loaded ${officerRows.length} officer(s).\n`);

  const officerSignals: OfficerSignals[] = officerRows.map((o) => ({
    officerId: o.officerId,
    fullName: `${o.firstName} ${o.lastName}`.trim(),
    rank: o.rank || null,
    currentUnit: o.currentUnit,
    region: o.region,
    phone: o.phone,
    extraPhones: o.phones.map((p) => p.number),
    timelineUnits: o.timeline.map((t) => t.unit).filter((u): u is string => Boolean(u)),
  }));

  // ── OCR each Profile image (local Tesseract only — no OpenAI, no classifier) ──
  const ocrEngine = new TesseractOCREngine({ defaultLanguage: "mixed" });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const classifications: ProfileImageClassification[] = [];
  let ocrFailures = 0;

  for (let i = 0; i < selected.length; i += 1) {
    const entry: DriveScanEntry = selected[i];
    console.log(`[${i + 1}/${selected.length}] OCR: ${entry.relativePath}`);

    let tempPath: string | undefined;
    try {
      const bytes = await client.downloadFile(entry.id);
      tempPath = path.join(TEMP_DIR, `${entry.id}${path.extname(entry.name) || ".jpg"}`);
      fs.writeFileSync(tempPath, bytes);

      const ocrResult = await ocrEngine.recognize(tempPath);
      const imageSignals: ProfileImageSignals = {
        fileId: entry.id,
        filename: entry.name,
        driveFolder: entry.relativePath,
        ocrText: ocrResult.fullText,
      };

      const scores = officerSignals.map((o) => scoreOfficerAgainstProfileImage(o, imageSignals));
      const withSignal = scores.filter((s) => s.confidence > 0);
      const classification = classifyCandidates(imageSignals, withSignal);

      classifications.push({
        fileId: entry.id,
        filename: entry.name,
        driveFolder: entry.relativePath,
        ...classification,
      });
    } catch (error) {
      ocrFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  OCR/download failed: ${message}`);
      classifications.push({
        fileId: entry.id,
        filename: entry.name,
        driveFolder: entry.relativePath,
        classification: "unknown_officer",
        candidates: [],
        explanation: `OCR/download failed: ${message}`,
      });
    } finally {
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // best-effort cleanup only
        }
      }
    }
  }

  await ocrEngine.terminate();

  // ── Second pass: flag duplicate candidates across all images ────────────
  const finalClassifications = flagDuplicateCandidates(classifications);

  // ── Tally + report ───────────────────────────────────────────────────────
  const tally = { safe_match: 0, needs_review: 0, duplicate_candidate: 0, unknown_officer: 0, conflict: 0 };
  for (const c of finalClassifications) tally[c.classification] += 1;

  console.log("\n================================================");
  console.log("DRY RUN RESULTS (no database writes were made)");
  console.log("================================================");
  console.log(`Total Profile images scanned: ${selected.length}`);
  console.log(`Safe matches (>=98%):          ${tally.safe_match}`);
  console.log(`Needs review (80-97%):         ${tally.needs_review}`);
  console.log(`Duplicate candidates:          ${tally.duplicate_candidate}`);
  console.log(`Unknown officer:               ${tally.unknown_officer}`);
  console.log(`Conflict (ambiguous):          ${tally.conflict}`);
  if (ocrFailures > 0) console.log(`OCR/download failures:         ${ocrFailures}`);
  console.log("");

  const safeMatches = finalClassifications.filter((c) => c.classification === "safe_match");
  if (safeMatches.length > 0) {
    console.log("Safe Matches:");
    for (const c of safeMatches) {
      const top = c.candidates[0];
      console.log(`  ${top.officerId}  "${top.fullName}"  <-  ${c.filename}  (${top.confidence}%)`);
    }
    console.log("");
  }

  // Only the top 10 candidates per image are written to disk (report
  // readability) — `candidateCount` preserves how many officers scored above
  // zero at all, so nothing about the classification decision is hidden.
  const MAX_CANDIDATES_IN_REPORT = 10;
  const reportClassifications = finalClassifications.map((c) => ({
    ...c,
    candidateCount: c.candidates.length,
    candidates: c.candidates.slice(0, MAX_CANDIDATES_IN_REPORT),
  }));

  writeJson(REPORT_PATH, {
    generatedAt: new Date().toISOString(),
    rootFolder: rootFolderId,
    totalProfileImagesDiscovered: profileEntries.length,
    totalScanned: selected.length,
    ocrFailures,
    tally,
    classifications: reportClassifications,
  });
  console.log(`Full report written to ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log("\nNo database rows were modified. No OCR was regenerated for existing officers. No imports were run.");
}

main().catch((error) => {
  console.error("Dry run crashed:", error);
  process.exitCode = 1;
});
