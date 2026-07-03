/**
 * Phase 9A — Production Batch Import Runner.
 *
 * Scans imports/<region>/ folders, processes every supported image through
 * the existing single-image pipeline (lib/import/personnel_image_processor.ts
 * — the exact same code path scripts/run_real_import.ts uses, not a
 * duplicate), writes one JSON per officer to exports/<region>/, and
 * produces logs/summary.json, logs/failed.json, logs/skipped.json.
 *
 * No database, no Supabase, no UI — filesystem only.
 *
 * Usage:
 *   npx tsx scripts/run_batch_import.ts
 *
 * Phase 9B forward-compatibility: everything from image discovery onward
 * (region detection, processing, resume support, output writing,
 * reporting) operates on the provider-agnostic `ImageSource`/
 * `DiscoveredImage` types (lib/import/image_source.ts). Swapping
 * `FilesystemImageSource` for a future `GoogleDriveImageSource` is the only
 * change Phase 9B should need — see `createImageSource` below, the single
 * seam this script depends on.
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables before any project modules read process.env.
// Mirrors scripts/run_real_import.ts exactly (see that file for rationale).
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
      "If OPENAI_API_KEY is not already set in your shell environment, set it in one of these files."
  );
}

import { processPersonnelImage } from "@/lib/import/personnel_image_processor";
import { FilesystemImageSource, type DiscoveredImage, type ImageSource } from "@/lib/import/image_source";
import { BatchReportBuilder } from "@/lib/import/batch_report";

const IMPORTS_DIR = path.join(process.cwd(), "imports");
const EXPORTS_DIR = path.join(process.cwd(), "exports");
const LOGS_DIR = path.join(process.cwd(), "logs");

/**
 * The single seam Phase 9B needs to change: swap this for a
 * `GoogleDriveImageSource` (backed by lib/google-drive's FolderScanner +
 * FolderMapper) to source images from Google Drive instead of the local
 * filesystem. Nothing below this function's call site needs to change.
 */
function createImageSource(): ImageSource {
  return new FilesystemImageSource(IMPORTS_DIR);
}

function outputPathFor(image: DiscoveredImage): string {
  const baseName = path.basename(image.filename, path.extname(image.filename));
  return path.join(EXPORTS_DIR, image.region, `${baseName}.json`);
}

function printHeader(): void {
  console.log("================================================");
  console.log("Border Police Personnel Import");
  console.log("================================================");
}

function printScanSummary(imagesByRegion: Map<string, DiscoveredImage[]>): void {
  console.log("Scanning folders...");
  console.log("");
  for (const [region, images] of imagesByRegion) {
    console.log(region);
    console.log(`${images.length} images`);
    console.log("");
  }
  console.log("--------------------------------");
}

function groupByRegion(images: DiscoveredImage[]): Map<string, DiscoveredImage[]> {
  const grouped = new Map<string, DiscoveredImage[]>();
  for (const image of images) {
    if (!grouped.has(image.region)) grouped.set(image.region, []);
    grouped.get(image.region)!.push(image);
  }
  return grouped;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main() {
  printHeader();

  const source = createImageSource();
  const { images, skipped } = await source.discover();

  const report = new BatchReportBuilder();
  for (const image of images) {
    report.registerDiscovered(image.region);
  }
  for (const skippedFile of skipped) {
    report.recordSkipped(skippedFile.file, skippedFile.region, skippedFile.reason);
  }

  const imagesByRegion = groupByRegion(images);
  printScanSummary(imagesByRegion);

  console.log("Processing");
  console.log("--------------------------------");

  const total = images.length;

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const position = `[${i + 1}/${total}]`;
    console.log(position);
    console.log(image.filename);

    const destination = outputPathFor(image);

    if (fs.existsSync(destination)) {
      console.log("Already processed");
      report.recordResumeSkipped(image.region);
      console.log("--------------------------------");
      continue;
    }

    try {
      const result = await processPersonnelImage(image.localPath);

      const output = {
        source_file: image.filename,
        region: image.region,
        processing_timestamp: new Date().toISOString(),
        processing_duration_ms: result.processing_metadata.processing_time_ms,
        ...result,
      };

      writeJson(destination, output);

      if (result.validation.valid) {
        console.log("SUCCESS");
        console.log(`${result.confidence}%`);
        report.recordSuccess(image.region, result.confidence, result.processing_metadata.processing_time_ms);
      } else {
        console.log("FAILED (validation)");
        report.recordFailure(image.filename, image.region, "Validation failed");
      }
    } catch (error) {
      // One failed image must not stop the batch — log and continue.
      const message = error instanceof Error ? error.message : String(error);
      console.log("FAILED");
      console.log(message);
      report.recordFailure(image.filename, image.region, message);
    }

    console.log("--------------------------------");
  }

  console.log("Completed");

  writeJson(path.join(LOGS_DIR, "summary.json"), report.buildSummary());
  writeJson(path.join(LOGS_DIR, "failed.json"), report.buildFailedReport());
  writeJson(path.join(LOGS_DIR, "skipped.json"), report.buildSkippedReport());

  console.log("");
  console.log(`Summary saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "summary.json"))}`);
  console.log(`Failed report saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "failed.json"))}`);
  console.log(`Skipped report saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "skipped.json"))}`);
}

main().catch((error) => {
  console.error("Batch import runner crashed:", error);
  process.exitCode = 1;
});
