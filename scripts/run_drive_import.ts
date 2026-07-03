/**
 * Phase 9C — Live Google Drive Import Runner.
 *
 * Sources personnel profile images from a live Google Drive tree (instead of
 * the local imports/ filesystem), processing each through the existing
 * single-image pipeline (lib/import/personnel_image_processor.ts — the exact
 * same code path scripts/run_real_import.ts and scripts/run_batch_import.ts
 * use, not a duplicate), and writes one JSON per officer to exports/<region>/.
 *
 * Pipeline per image:
 *   connect Drive -> discover (metadata only) -> resume check ->
 *   download single image to a temp file -> processPersonnelImage() ->
 *   export JSON -> delete temp image -> continue.
 *
 * Never downloads the whole Drive: only one image's bytes are on local disk
 * at a time, fetched on demand and deleted immediately after processing.
 *
 * Resume: identical rules to scripts/run_batch_import.ts — an existing
 * export or an existing classifier `.skipped.json` marker means the image is
 * skipped and never reprocessed.
 *
 * Read-only against Drive. No database, no Supabase, no UI.
 *
 * Usage:
 *   npx tsx scripts/run_drive_import.ts            # process every discovered image
 *   npx tsx scripts/run_drive_import.ts --limit 3  # process at most 3 (for a bounded real test)
 *
 * Configuration (.env.local):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *     (or GOOGLE_DRIVE_CREDENTIALS=<inline JSON>)
 *   GOOGLE_DRIVE_ROOT_FOLDER=<root folder id>
 *   OPENAI_API_KEY=<key used by the existing Vision pipeline>
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables before any project modules read process.env.
// Mirrors scripts/run_batch_import.ts exactly (see that file for rationale).
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
  console.warn(
    `Warning: no .env.local or .env file found in ${process.cwd()}. ` +
      "GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_DRIVE_CREDENTIALS, GOOGLE_DRIVE_ROOT_FOLDER, and OPENAI_API_KEY must already be set in your shell environment."
  );
}

import { processPersonnelImage } from "@/lib/import/personnel_image_processor";
import type { ImageSource } from "@/lib/import/image_source";
import { BatchReportBuilder } from "@/lib/import/batch_report";
import { ImageClassifier } from "@/lib/classifier/image_classifier";
import { DefaultClassificationStatisticsBuilder } from "@/lib/classifier/classification_statistics";
import { createDriveAuthClient, DriveAuthConfigError } from "@/lib/google-drive/drive_auth";
import { GoogleDriveClient } from "@/lib/google-drive/google_drive_client";
import { GoogleDriveImageSource } from "@/lib/google-drive/google_drive_image_source";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";
import { resumeDecision, resumePathsFor } from "@/lib/import/drive_import_resume";

const EXPORTS_DIR = path.join(process.cwd(), "exports");
const LOGS_DIR = path.join(process.cwd(), "logs");

/** The Phase 9C import-summary shape: total / processed / skipped / failed / duration_ms. */
interface DriveImportSummary {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  duration_ms: number;
}

/** Parses `--limit N` (0/absent = no limit). Bounds the real test to a handful of images. */
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

function printHeader(): void {
  console.log("================================================");
  console.log("Border Police Personnel Import — Google Drive");
  console.log("================================================");
}

/**
 * Builds the Google Drive image source. Authenticates with the existing
 * service account (read-only scope) and wires the existing FolderScanner/
 * MimeImageFilter/DepthBasedFolderMapper stack via GoogleDriveImageSource.
 * Returns undefined (after printing a readable message) if configuration is
 * missing, so main() can exit cleanly without a stack trace.
 */
function createDriveImageSource(rootFolderId: string): ImageSource | undefined {
  let auth;
  try {
    auth = createDriveAuthClient();
  } catch (error) {
    if (error instanceof DriveAuthConfigError) {
      console.error(`Google Drive authentication is not configured: ${error.message}`);
      return undefined;
    }
    throw error;
  }

  const client = new GoogleDriveClient({ auth, supportsSharedDrives: true });
  return new GoogleDriveImageSource({ rootFolderId, client, sharedDrive: true });
}

async function main() {
  printHeader();

  const startedAt = Date.now();
  const limit = parseLimit(process.argv.slice(2));

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER;
  if (!rootFolderId) {
    console.error("GOOGLE_DRIVE_ROOT_FOLDER is not set. Add it to .env.local, then re-run.");
    process.exitCode = 1;
    return;
  }

  const source = createDriveImageSource(rootFolderId);
  if (!source) {
    process.exitCode = 1;
    return;
  }

  console.log("Connecting to Google Drive...");
  console.log("Discovering images (metadata only)...");

  let discovery;
  try {
    // discoverImages() is the Phase 9C alias; falls back to discover() for
    // any source that only implements the base method.
    discovery = source.discoverImages ? await source.discoverImages() : await source.discover();
  } catch (error) {
    if (error instanceof DriveProviderError) {
      console.error(`Google Drive discovery failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const { images, skipped } = discovery;
  const selected = limit > 0 ? images.slice(0, limit) : images;

  console.log(`Discovered ${images.length} image(s)${limit > 0 ? `, importing at most ${limit}` : ""}.`);
  console.log("--------------------------------");

  const report = new BatchReportBuilder();
  for (const image of selected) {
    report.registerDiscovered(image.region);
  }
  for (const skippedFile of skipped) {
    report.recordSkipped(skippedFile.file, skippedFile.region, skippedFile.reason);
  }

  const classifier = new ImageClassifier();
  const classificationStats = new DefaultClassificationStatisticsBuilder();

  let failedCount = 0;
  const total = selected.length;

  for (let i = 0; i < selected.length; i += 1) {
    const image = selected[i];
    console.log(`[${i + 1}/${total}] ${image.region}/${image.filename}`);

    const paths = resumePathsFor(EXPORTS_DIR, image.region, image.filename);
    const destination = paths.exportPath;
    const classifierSkipMarker = paths.skipMarkerPath;

    // Resume support — identical rule to run_batch_import.ts (shared via
    // lib/import/drive_import_resume.ts): an already-exported image, or one
    // previously skipped by the classifier, is never retried and
    // (importantly) never downloaded.
    const resume = resumeDecision(paths, fs.existsSync);
    if (resume.skip) {
      console.log(
        resume.reason === "already_exported"
          ? "Already processed"
          : "Already processed (previously skipped by classifier)"
      );
      report.recordResumeSkipped(image.region);
      console.log("--------------------------------");
      continue;
    }

    // Download exactly this one image now that we've decided to process it.
    let opened;
    try {
      opened = source.openImage
        ? await source.openImage(image)
        : { localPath: image.localPath, dispose: async () => {} };
    } catch (error) {
      // A download failure for one image must not abort the whole import.
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAILED (download): ${message}`);
      report.recordFailure(image.filename, image.region, `download: ${message}`);
      failedCount += 1;
      console.log("--------------------------------");
      continue;
    }

    try {
      // Classifier runs BEFORE processPersonnelImage() (and therefore before
      // any OpenAI Vision call), on the downloaded temp file.
      const classification = await classifier.classify({ source: opened.localPath });
      classificationStats.add(classification);

      if (!classification.shouldProcess) {
        console.log(`SKIPPED (classification): ${classification.category} (${classification.confidence}%)`);
        writeJson(classifierSkipMarker, {
          source_file: image.filename,
          region: image.region,
          source_id: image.sourceId,
          classification,
          timestamp: new Date().toISOString(),
        });
        report.recordSkipped(image.filename, image.region, "classification", {
          category: classification.category,
          confidence: classification.confidence,
        });
        continue;
      }

      const result = await processPersonnelImage(opened.localPath);

      const output = {
        source_file: image.filename,
        region: image.region,
        source_id: image.sourceId,
        source: "google_drive",
        processing_timestamp: new Date().toISOString(),
        processing_duration_ms: result.processing_metadata.processing_time_ms,
        classification,
        ...result,
      };

      writeJson(destination, output);

      if (result.validation.valid) {
        console.log(`SUCCESS ${result.confidence}%`);
        report.recordSuccess(image.region, result.confidence, result.processing_metadata.processing_time_ms);
      } else {
        console.log("FAILED (validation)");
        report.recordFailure(image.filename, image.region, "Validation failed");
        failedCount += 1;
      }
    } catch (error) {
      // One failed image must never stop the whole import — log and continue.
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAILED: ${message}`);
      report.recordFailure(image.filename, image.region, message);
      failedCount += 1;
    } finally {
      // Always delete the temp image, whether processing succeeded, was
      // skipped, or threw.
      await opened.dispose();
    }

    console.log("--------------------------------");
  }

  const batchSummary = report.buildSummary();
  const driveImportSummary: DriveImportSummary = {
    total: images.length,
    processed: batchSummary.success,
    skipped: batchSummary.skipped + batchSummary.resume_skipped,
    failed: failedCount,
    duration_ms: Date.now() - startedAt,
  };

  writeJson(path.join(LOGS_DIR, "drive_import_summary.json"), driveImportSummary);
  writeJson(path.join(LOGS_DIR, "drive_import_failed.json"), report.buildFailedReport());
  writeJson(path.join(LOGS_DIR, "drive_import_skipped.json"), report.buildSkippedReport());
  writeJson(path.join(LOGS_DIR, "drive_import_classification.json"), classificationStats.build());

  console.log("Completed");
  console.log(JSON.stringify(driveImportSummary, null, 2));
  console.log(`Summary saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "drive_import_summary.json"))}`);
}

main().catch((error) => {
  console.error("Drive import runner crashed:", error);
  process.exitCode = 1;
});
