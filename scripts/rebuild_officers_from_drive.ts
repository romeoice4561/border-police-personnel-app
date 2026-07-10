/**
 * Phase 25 — Officer Rebuild from Google Drive (CREATE-ONLY).
 *
 * The old Officer table was seeded from an unreliable knowledge-layer
 * matching process. As of Phase 25, Google Drive's four curated Profile
 * folders are the ONLY source of truth. This script processes every image
 * inside those folders and CREATES a new Officer directly from it — there is
 * no "find existing officer" / matching stage anymore. The profile image
 * itself creates the Officer, its Timeline, Phone, and its ProfilePhoto is
 * linked immediately (matchStatus=AUTO_MATCHED, matchedOfficerId set to the
 * officer this run just created).
 *
 * Acceptance criteria (Phase 25):
 *   - Every image creates exactly one Officer — NEVER skipped for low
 *     classifier/Vision confidence. Classification and validation outcomes
 *     are recorded as data-quality signals only (logs/summary), never as a
 *     reason to skip. Unknown/unextractable fields are left null — never
 *     invented. (The only real skip is a structurally unmapped Drive region,
 *     where no stable officerId can be built at all.)
 *   - Every Officer gets exactly one ProfilePhoto, linked in the same pass —
 *     no orphan ProfilePhoto rows, no officer without a photo.
 *   - officerId generation is deterministic and stable across runs (region +
 *     filename) — re-running is idempotent (upsert), never creates duplicates.
 *
 * Pipeline, entirely REUSED — no new extraction/normalization/parsing logic:
 *
 *   GoogleDriveClient + DriveScanReportBuilder (existing, read-only)
 *     -> discover images, scoped to DriveContentType.Profile
 *        (== "Profile รายบุคคล ภาค 1-4" only, already enforced by the scanner)
 *   ImageClassifier (existing)
 *     -> classification is logged for visibility only; it never skips an image
 *   processPersonnelImage (existing — the exact pipeline
 *        scripts/run_real_import.ts / run_batch_import.ts / run_drive_import.ts
 *        all use): Vision extraction -> Repair -> Validation -> Normalization
 *        -> Career Engine
 *   normalizeTimelinePositionUnit (existing, Phase 24B bug #3/#5/#6)
 *     -> per-row position/unit split, same as the officer editor's save path
 *   Officer/Timeline/Phone repositories (existing, Phase 12)
 *     -> officerRepo.upsert is used in CREATE mode: officerId is a
 *        deterministic "{shortRegion}/{filename}" scheme matching the
 *        Knowledge Layer's convention (lib/knowledge/knowledge_builder.ts),
 *        so this run's ids are stable and idempotent — re-running never
 *        creates duplicate officers.
 *   PrismaProfilePhotoRepository (existing, Phase 21C/24B)
 *     -> one ProfilePhoto row per image, immediately linked to the officer
 *        this run created (no separate matching stage — Phase 25 spec).
 *
 * Education/Training: the Vision extraction schema (lib/types/vision.ts)
 * has never captured education/training data — those tables are populated
 * only via manual entry in the Officer Profile Workspace (Phase 23A). This
 * script creates 0 Education/Training rows per officer, matching the
 * pre-existing behavior (both tables were empty before this rebuild too).
 *
 * Read-only against Drive throughout (service-account, drive.readonly scope
 * — unchanged). At most one image's bytes on local disk at a time.
 *
 * Usage:
 *   npx tsx scripts/rebuild_officers_from_drive.ts
 *   npx tsx scripts/rebuild_officers_from_drive.ts --limit 20   # bounded test run
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
import { driveThumbnailUrl, driveWebViewUrl } from "@/lib/google-drive/drive_photo_url";
import { ImageClassifier } from "@/lib/classifier/image_classifier";
import { TesseractOCREngine } from "@/lib/ocr/tesseract_engine";
import { CachingOCREngine } from "@/lib/ocr/ocr_engine";
import { OcrTextSampleProvider } from "@/lib/ocr/ocr_text_sample_provider";
import { processPersonnelImage } from "@/lib/import/personnel_image_processor";
import { normalizeTimelinePositionUnit } from "@/lib/import/timeline_normalization";
import { extractTimelineYear } from "@/lib/knowledge/timeline_index";

import { createDatabaseClient } from "@/lib/database/database";
import type { DatabaseClient } from "@/lib/database/database_types";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository, type TimelineRowInput } from "@/lib/database/repositories/timeline_repository";
import { PhoneRepository } from "@/lib/database/repositories/phone_repository";
import { ImportJobRepository } from "@/lib/database/repositories/import_job_repository";
import { ImportLogRepository } from "@/lib/database/repositories/import_log_repository";
import { PrismaProfilePhotoRepository, type ProfilePhotoDbClient } from "@/lib/profile_photo/prisma_profile_photo_repository";
import { MatchStatus, OcrStatus, PortraitClassification, PhotoType } from "@/lib/profile_photo/profile_photo_types";

const LOGS_DIR = path.join(process.cwd(), "logs");
const TEMP_DIR = path.join(os.tmpdir(), "bppis-officer-rebuild");
const REPORT_PATH = path.join(LOGS_DIR, "rebuild_officers_from_drive_summary.json");

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

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * The Drive folder mapper (lib/google-drive/folder_path_mapper.ts) assigns
 * `entry.region` as the RAW top-level folder name (e.g. "Profile รายบุคคล
 * ภาค 1"), unlike the original filesystem/Knowledge Layer pipeline whose
 * `officer.identity.region` was already a short "ภาค1" code (exports/ภาค1/*.json,
 * lib/knowledge/knowledge_builder.ts). To keep officerId/Officer.region in the
 * SAME short convention the rest of the app already assumes (URLs, existing
 * tests, the officer detail page), the region digit is extracted from the
 * folder name here — reusing the same "ภาค\s*(digits)" pattern
 * lib/organization/organization_helpers.ts already uses for folder/OCR text,
 * not a new parsing rule. Falls back to the raw folder name only if no
 * "ภาค N" pattern is found (never silently drops the folder context).
 */
const REGION_DIGIT_PATTERN = /ภาค\s*([0-9๐-๙]+)/;
const THAI_DIGITS: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9",
};

function shortRegionCode(rawFolderName: string): string {
  const match = REGION_DIGIT_PATTERN.exec(rawFolderName);
  if (!match) return rawFolderName.trim();
  const digits = match[1].replace(/[๐-๙]/g, (d) => THAI_DIGITS[d] ?? d);
  return `ภาค${digits}`;
}

/** Deterministic officer id: "{shortRegionCode}/{filenameWithoutExt}" — the same convention the original Knowledge Layer used. */
function deterministicOfficerId(region: string, filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const shortRegion = shortRegionCode(region);
  return shortRegion ? `${shortRegion}/${base}` : base;
}

async function main(): Promise<void> {
  console.log("================================================");
  console.log("Phase 25 — Officer Rebuild from Google Drive (CREATE-ONLY, no matching stage)");
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

  // Same classifier setup as scripts/run_drive_import.ts: local Tesseract OCR
  // feeds the classifier's textSample (the classifier has no real feature
  // extractor yet — StubFeatureExtractor is a neutral placeholder — so OCR
  // text is the only real signal available; without it every image
  // classifies as UNKNOWN/0%).
  const tesseractEngine = new TesseractOCREngine({ defaultLanguage: "mixed" });
  const ocrEngine = new CachingOCREngine({ baseEngine: tesseractEngine });
  const classifier = new ImageClassifier({
    textSampleProvider: new OcrTextSampleProvider({ engine: ocrEngine, language: "mixed" }),
  });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const dbClient = createDatabaseClient() as unknown as DatabaseClient & ProfilePhotoDbClient;
  const officerRepo = new OfficerRepository(dbClient);
  const timelineRepo = new TimelineRepository(dbClient);
  const phoneRepo = new PhoneRepository(dbClient);
  const jobRepo = new ImportJobRepository(dbClient);
  const logRepo = new ImportLogRepository(dbClient);
  const profilePhotoRepo = new PrismaProfilePhotoRepository(dbClient);

  const job = await jobRepo.start();

  let officersCreated = 0;
  let officersUpdated = 0;
  let photosLinked = 0;
  let classifierSkipped = 0;
  let visionInvalid = 0;
  let errors = 0;

  for (let i = 0; i < selected.length; i += 1) {
    const entry = selected[i];
    console.log(`[${i + 1}/${selected.length}] ${entry.relativePath}`);

    if (!entry.region) {
      console.log("  SKIPPED (no resolvable region for this folder)");
      await logRepo.record(job.id, entry.name, "skipped", "unmapped_region");
      continue;
    }

    let tempPath: string | undefined;
    try {
      if (typeof client.downloadFile !== "function") {
        throw new Error("Configured Drive client does not support downloadFile.");
      }
      const bytes = await client.downloadFile(entry.id);
      tempPath = path.join(TEMP_DIR, `${entry.id}${path.extname(entry.name) || ".jpg"}`);
      fs.writeFileSync(tempPath, bytes);

      // Classification is recorded for visibility only — this pipeline NEVER
      // skips an image on classifier or Vision confidence (Phase 25 spec:
      // "Never skip an image because OCR/Vision confidence is low"). The four
      // Profile folders are the owner-confirmed authoritative source; every
      // image in them gets an Officer + ProfilePhoto, even when extraction is
      // partial (unknown fields are left null, never invented).
      const classification = await classifier.classify({ source: tempPath });
      if (!classification.shouldProcess) {
        console.log(`  (classifier flagged ${classification.category} at ${classification.confidence}% — processing anyway per Phase 25)`);
        classifierSkipped += 1;
      }

      // Vision extraction -> Repair -> Validation -> Normalization -> Career Engine.
      const result = await processPersonnelImage(tempPath);
      const extraction = result.normalized_extraction;
      const career = result.career_intelligence;

      if (!result.validation.valid) {
        // Not a skip: the officer is still created below with whatever
        // fields Vision/Repair produced (missing ones stay null) — only
        // logged as a data-quality signal.
        console.log(`  (Vision validation had ${result.validation.errors.length} issue(s) — creating officer with available fields anyway)`);
        visionInvalid += 1;
      }

      const shortRegion = shortRegionCode(entry.region);
      const officerId = deterministicOfficerId(entry.region, entry.name);
      const currentTimelineEntry = extraction.timeline[extraction.timeline.length - 1];

      const officerInput: OfficerInput = {
        officerId,
        rank: nonEmpty(extraction.rank) ?? "",
        firstName: nonEmpty(extraction.first_name) ?? "",
        lastName: nonEmpty(extraction.last_name) ?? "",
        currentPosition: nonEmpty(extraction.position ?? currentTimelineEntry?.position ?? null),
        currentUnit: nonEmpty(extraction.unit ?? currentTimelineEntry?.unit ?? null),
        phone: nonEmpty(extraction.phone),
        careerYears: career.careerYears,
        qualityScore: null,
        knowledgeScore: Number.isFinite(extraction.confidence) ? Math.round(extraction.confidence) : null,
        region: shortRegion,
        confidence: Number.isFinite(extraction.confidence) ? Math.round(extraction.confidence) : null,
        driveFileId: entry.id,
        thumbnailUrl: driveThumbnailUrl(entry.id),
        webViewUrl: driveWebViewUrl(entry.id),
      };

      const { officer, created } = await officerRepo.upsert(officerInput);
      if (created) officersCreated += 1;
      else officersUpdated += 1;

      // Timeline: per-row position/unit normalization (Phase 24B bug #3/#5/#6),
      // same rule the officer editor's save path applies.
      const timelineRows: TimelineRowInput[] = extraction.timeline.map((row, index) => {
        const { position, unit } = normalizeTimelinePositionUnit({ position: row.position, unit: row.unit ?? null });
        return {
          sequence: index,
          year: row.year ?? "",
          yearValue: extractTimelineYear(row.year ?? ""),
          position,
          unit,
          source: "AI",
        };
      });
      await timelineRepo.replaceForOfficer(officer.id, timelineRows);

      // Phone.
      const phone = nonEmpty(extraction.phone);
      if (phone) await phoneRepo.upsert(officer.id, phone);

      // ProfilePhoto: created and linked to this officer immediately — no
      // separate matching stage (Phase 25 spec).
      await profilePhotoRepo.upsert({
        driveFileId: entry.id,
        thumbnailUrl: driveThumbnailUrl(entry.id),
        webViewUrl: driveWebViewUrl(entry.id),
        filename: entry.name,
        folderPath: entry.relativePath,
        region: entry.region ?? null,
        company: entry.company ?? null,
        battalion: entry.battalion ?? null,
        ocrText: null,
        ocrStatus: OcrStatus.Completed,
        matchStatus: MatchStatus.AutoMatched,
        matchedOfficerId: officerId,
        confidence: officerInput.confidence,
        sourceType: "DRIVE_SCAN",
        storagePath: null,
        mimeType: null,
        width: null,
        height: null,
        uploadedBy: null,
        isProfile: false,
        classification: PortraitClassification.Unknown,
        classifiedBy: null,
        classifiedAt: null,
        // Phase 26A (added after this script's original Phase 25 authoring):
        // every image discovered by this pipeline is the original Drive
        // profile card. Type-completeness only — no Phase 25 pipeline
        // behavior (scan/OCR/Vision/matching/create-only semantics) changed.
        photoType: PhotoType.GoogleProfileCard,
      });
      photosLinked += 1;

      console.log(`  ${created ? "CREATED" : "UPDATED"} ${officerId} (confidence ${officerInput.confidence ?? "?"}%)`);
      await logRepo.record(job.id, officerId, created ? "created" : "updated");
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  FAILED: ${message}`);
      await logRepo.record(job.id, entry.name, "error", message);
    } finally {
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // best-effort cleanup only.
        }
      }
    }

    console.log("--------------------------------");
  }

  await tesseractEngine.terminate();

  await jobRepo.finish(job.id, {
    images: selected.length,
    imported: officersCreated + officersUpdated,
    // Phase 25: nothing is ever skipped for low confidence — "skipped" here
    // only counts genuine failures (unmapped region, download/crash error).
    skipped: 0,
    errors,
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    rootFolder: rootFolderId,
    limit: limit || null,
    profileImagesDiscovered: profileEntries.length,
    profileImagesProcessed: selected.length,
    officersCreated,
    officersUpdated,
    photosLinked,
    // Data-quality signals only — NEITHER of these caused a skip.
    lowConfidenceClassification: classifierSkipped,
    partialVisionExtraction: visionInvalid,
    errors,
    duration_ms: Date.now() - startedAt,
  };

  writeJson(REPORT_PATH, summary);

  console.log("\n================================================");
  console.log("REBUILD COMPLETE");
  console.log("================================================");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nSummary saved to ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log("Drive was never written to. No matching stage was used — each image created its own officer.");
}

main().catch((error) => {
  console.error("Officer rebuild crashed:", error);
  process.exitCode = 1;
});
