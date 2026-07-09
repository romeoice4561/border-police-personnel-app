/**
 * Phase 24B-3 — Google Drive Portrait Rebuild.
 *
 * Rebuilds the ProfilePhoto dataset from the four authoritative,
 * manually-curated Drive folders ("Profile รายบุคคล ภาค 1-4") — the only
 * folders DriveContentType classifies as PROFILE content, so scope is
 * already enforced by the existing scanner (lib/google-drive/drive_content_type.ts),
 * not reimplemented here.
 *
 * Pipeline, entirely REUSED (no new scanning/OCR/classification/matching
 * logic is written in this file):
 *
 *   DriveScanReportBuilder (existing)  -> discover Profile images (metadata only)
 *   TesseractOCREngine (existing)      -> local OCR per image
 *   ImageClassifier (existing)         -> image-content classification (metadata only,
 *                                          mapped via lib/profile_photo/image_category_mapping.ts)
 *   decideMatchesForPhotos (existing, via ProfilePhotoImporter)
 *                                       -> officer matching, exactly Phase 21C's rules
 *   ProfilePhotoService.ingest (existing)
 *                                       -> idempotent upsert, never deletes history,
 *                                          never overwrites MANUAL_MATCHED/UPLOAD rows
 *                                          (Phase 24B-3 repository hardening)
 *
 * Read-only against Drive (service-account, drive.readonly scope — unchanged).
 * No Drive write call exists anywhere in this pipeline. Bytes for at most one
 * image are on local disk at a time (downloaded, OCR'd, classified, deleted).
 *
 * Safe to re-run: every run re-upserts by driveFileId; officers not matched
 * this run are simply left unlinked (never guessed); rows already manually
 * matched or uploaded are never touched.
 *
 * Usage:
 *   npx tsx scripts/rebuild_drive_portraits.ts
 *   npx tsx scripts/rebuild_drive_portraits.ts --limit 20   # bounded test run
 *
 * Configuration (.env.local):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *     (or GOOGLE_DRIVE_CREDENTIALS=<inline JSON>)
 *   GOOGLE_DRIVE_ROOT_FOLDER=<root folder id>
 *   DATABASE_URL / DIRECT_URL (existing Supabase/Postgres connection)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const ENV_FILES = [".env.local", ".env"];
let loadedEnvFile: string | undefined;
for (const envFile of ENV_FILES) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    loadedEnvFile = loadedEnvFile ?? envFile;
  }
}
if (!loadedEnvFile) {
  console.warn(`Warning: no .env.local or .env file found in ${process.cwd()}.`);
}

import { createDriveAuthClient, DriveAuthConfigError } from "@/lib/google-drive/drive_auth";
import { GoogleDriveClient } from "@/lib/google-drive/google_drive_client";
import { FolderScanner } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import { DriveScanReportBuilder, type DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";
import { TesseractOCREngine } from "@/lib/ocr/tesseract_engine";
import { ImageClassifier } from "@/lib/classifier/image_classifier";
import { toPortraitClassification } from "@/lib/profile_photo/image_category_mapping";
import type { OfficerSignals } from "@/lib/import/profile_relink_matcher";
import type { OcrTextByFileId, ClassificationByFileId } from "@/lib/profile_photo/profile_photo_importer";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";

const LOGS_DIR = path.join(process.cwd(), "logs");
const TEMP_DIR = path.join(os.tmpdir(), "bppis-portrait-rebuild");
const REPORT_PATH = path.join(LOGS_DIR, "rebuild_drive_portraits_summary.json");

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
  console.log("Phase 24B-3 — Google Drive Portrait Rebuild");
  console.log("Scope: Profile รายบุคคล ภาค 1-4 only (DriveContentType.Profile)");
  console.log("================================================\n");

  const startedAt = Date.now();
  const limit = parseLimit(process.argv.slice(2));

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER;
  if (!rootFolderId) {
    console.error("GOOGLE_DRIVE_ROOT_FOLDER is not set. Add it to .env.local, then re-run.");
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

  console.log("Scanning Google Drive (metadata only, read-only)...");
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

  const profileEntries: DriveScanEntry[] = scanReport.entries.filter(
    (e) => e.isImage && e.content_type === DriveContentType.Profile
  );
  const selected = limit > 0 ? profileEntries.slice(0, limit) : profileEntries;

  console.log(`Discovered ${scanReport.entries.length} total entries; ${profileEntries.length} Profile image(s).`);
  if (limit > 0) console.log(`--limit ${limit}: processing ${selected.length}.`);
  console.log("");

  // ── Load existing officers (read-only) for matching — same signals the
  //    existing matcher already uses (never re-derived). ─────────────────────
  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();

  console.log("Loading existing officers (read-only)...");
  const officerRows = await db.officer.findMany({ include: { timeline: true, phones: true } });
  console.log(`Loaded ${officerRows.length} officer(s).\n`);

  const officers: OfficerSignals[] = officerRows.map((o) => ({
    officerId: o.officerId,
    fullName: `${o.firstName} ${o.lastName}`.trim(),
    rank: o.rank || null,
    currentUnit: o.currentUnit,
    region: o.region,
    phone: o.phone,
    extraPhones: o.phones.map((p) => p.number),
    timelineUnits: o.timeline.map((t) => t.unit).filter((u): u is string => Boolean(u)),
  }));

  // ── Per-image: OCR (local Tesseract, existing engine) + classify (existing
  //    engine) on a temp download, then dispose. At most one image's bytes on
  //    disk at a time. ─────────────────────────────────────────────────────
  const ocrEngine = new TesseractOCREngine({ defaultLanguage: "mixed" });
  const classifier = new ImageClassifier();
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const ocrByFileId: OcrTextByFileId = new Map();
  const classificationByFileId: ClassificationByFileId = new Map();
  let ocrFailures = 0;
  let downloadFailures = 0;

  for (let i = 0; i < selected.length; i += 1) {
    const entry = selected[i];
    console.log(`[${i + 1}/${selected.length}] ${entry.relativePath}`);

    let tempPath: string | undefined;
    try {
      if (typeof client.downloadFile !== "function") {
        throw new Error("Configured Drive client does not support downloadFile.");
      }
      const bytes = await client.downloadFile(entry.id);
      tempPath = path.join(TEMP_DIR, `${entry.id}${path.extname(entry.name) || ".jpg"}`);
      fs.writeFileSync(tempPath, bytes);

      const [ocrResult, classification] = await Promise.all([
        ocrEngine.recognize(tempPath).catch((error) => {
          ocrFailures += 1;
          console.log(`  OCR failed: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }),
        classifier.classify({ source: tempPath }),
      ]);

      if (ocrResult) {
        ocrByFileId.set(entry.id, { text: ocrResult.fullText, failed: false });
      } else {
        ocrByFileId.set(entry.id, { text: "", failed: true });
      }
      classificationByFileId.set(entry.id, toPortraitClassification(classification.category));
    } catch (error) {
      downloadFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  Download failed: ${message}`);
      // The photo is still imported below (Phase 21C invariant: no image is
      // ever lost) — just with ocrStatus PENDING and classification UNKNOWN.
    } finally {
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // best-effort cleanup only — never abort the run over this.
        }
      }
    }
  }

  await ocrEngine.terminate();

  // ── Persist: the EXISTING ProfilePhotoImporter/Service handle matching +
  //    idempotent upsert. No matching or persistence logic is duplicated here. ──
  console.log("\nMatching + persisting (idempotent upsert, history preserved)...");
  const { importer } = await getProfilePhotoContainer();
  const summary = await importer.import(scanReport.entries, { ocrByFileId, officers, classificationByFileId });

  const rebuildSummary = {
    generatedAt: new Date().toISOString(),
    rootFolder: rootFolderId,
    limit: limit || null,
    profileImagesDiscovered: profileEntries.length,
    profileImagesProcessed: selected.length,
    ocrFailures,
    downloadFailures,
    importSummary: summary,
    duration_ms: Date.now() - startedAt,
  };

  writeJson(REPORT_PATH, rebuildSummary);

  console.log("\n================================================");
  console.log("REBUILD COMPLETE");
  console.log("================================================");
  console.log(JSON.stringify(rebuildSummary, null, 2));
  console.log(`\nSummary saved to ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log("No history was deleted. No manually-matched or uploaded portraits were overwritten. Drive was never written to.");
}

main().catch((error) => {
  console.error("Portrait rebuild crashed:", error);
  process.exitCode = 1;
});
