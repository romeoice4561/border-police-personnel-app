/**
 * Skipped-import recovery (Phase 17C).
 *
 * `run_drive_import.ts` writes a `<name>.skipped.json` marker whenever the
 * Smart Image Classifier returns `shouldProcess: false` — i.e. it could not
 * confidently classify the image as a PERSONNEL_PROFILE (all observed skips are
 * UNKNOWN / confidence 0). That gate runs BEFORE OpenAI, so a classifier
 * false-negative (a real officer card the classifier is unsure about) is
 * skipped and never extracted.
 *
 * This recovery pass re-processes every skipped image THROUGH THE REAL
 * PIPELINE (download by the stored Drive `source_id` → processPersonnelImage),
 * BYPASSING the classifier gate, and keeps a result ONLY when it is a genuine
 * personnel record — the extraction validates OR carries a real rank + name.
 * Empty extractions (genuine non-personnel images: maps, tables, allocation
 * charts) are left skipped, because OpenAI itself found no personnel data.
 *
 * It reuses the existing Drive client, image download, and
 * processPersonnelImage — no re-scan of Drive, no second OCR/OpenAI
 * implementation, no DB or UI code. On a successful recovery it writes a real
 * export (identical shape to run_drive_import's success output) and removes the
 * `.skipped.json` marker; on a non-recovery it leaves the marker in place.
 *
 * Usage:
 *   npx tsx scripts/recover_skipped_imports.ts            # recover all
 *   npx tsx scripts/recover_skipped_imports.ts --limit 20 # bounded pass
 *   npx tsx scripts/recover_skipped_imports.ts --dry-run  # report only, write nothing
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

import { createDriveAuthClient, DriveAuthConfigError } from "@/lib/google-drive/drive_auth";
import { GoogleDriveClient } from "@/lib/google-drive/google_drive_client";
import { processPersonnelImage } from "@/lib/import/personnel_image_processor";

const EXPORTS_DIR = path.join(process.cwd(), "exports");
const LOGS_DIR = path.join(process.cwd(), "logs");
const TEMP_DIR = path.join(os.tmpdir(), "bppis-recovery");

interface SkipMarker {
  file: string; // the .skipped.json path
  source_file: string;
  region: string;
  source_id?: string;
  classification?: { category?: string; confidence?: number };
}

interface RecoveryReason {
  file: string;
  region: string;
  reason: string;
  stage: string;
  error?: string;
}

/** Recursively finds every .skipped.json marker under exports/. */
function findSkipMarkers(dir: string): SkipMarker[] {
  const out: SkipMarker[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".skipped.json")) continue;
      try {
        const j = JSON.parse(fs.readFileSync(full, "utf8")) as Omit<SkipMarker, "file">;
        out.push({ file: full, ...j });
      } catch {
        out.push({ file: full, source_file: entry.name, region: path.basename(path.dirname(full)) });
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** The real export path for a recovered marker (drops the `.skipped` suffix). */
function exportPathFor(marker: SkipMarker): string {
  const base = path.basename(marker.file).replace(/\.skipped\.json$/, "");
  return path.join(path.dirname(marker.file), `${base}.json`);
}

function parseLimit(argv: string[]): number {
  const i = argv.indexOf("--limit");
  if (i === -1) return 0;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** A genuine personnel record: passes validation, OR has a real rank AND name. */
function isRecoverablePersonnel(result: Awaited<ReturnType<typeof processPersonnelImage>>): boolean {
  const ex = result.normalized_extraction;
  const hasName = `${(ex.first_name || "").trim()}${(ex.last_name || "").trim()}`.length > 0;
  const hasRank = (ex.rank || "").trim().length > 0;
  return result.validation.valid || (hasName && hasRank);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const limit = parseLimit(argv);

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

  const allMarkers = findSkipMarkers(EXPORTS_DIR);
  const withId = allMarkers.filter((m) => Boolean(m.source_id));
  const withoutId = allMarkers.filter((m) => !m.source_id);
  const markers = limit > 0 ? withId.slice(0, limit) : withId;

  console.log("================================================");
  console.log("Skipped-Import Recovery");
  console.log("================================================");
  console.log(`Skip markers found: ${allMarkers.length} (re-downloadable: ${withId.length}, no source_id: ${withoutId.length})`);
  console.log(`Attempting recovery on: ${markers.length}${dryRun ? " (DRY RUN — no writes)" : ""}`);
  console.log("------------------------------------------------");

  let recovered = 0;
  let stillNonPersonnel = 0;
  let errors = 0;
  const remaining: RecoveryReason[] = [];

  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const label = `[${i + 1}/${markers.length}] ${marker.region}/${marker.source_file}`;

    let tempPath: string | undefined;
    try {
      // Stage: download (by stored Drive file id — no re-scan).
      const bytes = await client.downloadFile!(marker.source_id as string);
      fs.mkdirSync(TEMP_DIR, { recursive: true });
      tempPath = path.join(TEMP_DIR, `${randomUUID()}${path.extname(marker.source_file) || ".jpg"}`);
      fs.writeFileSync(tempPath, bytes);

      // Stage: extraction (bypasses the classifier gate).
      const result = await processPersonnelImage(tempPath);

      if (isRecoverablePersonnel(result)) {
        recovered += 1;
        const ex = result.normalized_extraction;
        console.log(`${label} → RECOVERED: ${ex.rank} ${ex.first_name} ${ex.last_name} (conf ${result.confidence})`);

        if (!dryRun) {
          const output = {
            source_file: marker.source_file,
            region: marker.region,
            source_id: marker.source_id,
            source: "google_drive",
            recovered: true,
            processing_timestamp: new Date().toISOString(),
            processing_duration_ms: result.processing_metadata.processing_time_ms,
            ...result,
          };
          writeJson(exportPathFor(marker), output);
          // Remove the skip marker so it no longer counts as skipped.
          fs.rmSync(marker.file, { force: true });
        }
      } else {
        stillNonPersonnel += 1;
        console.log(`${label} → not personnel (empty extraction) — left skipped`);
        remaining.push({
          file: marker.file,
          region: marker.region,
          reason: "non_personnel_empty_extraction",
          stage: "extraction",
        });
      }
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`${label} → ERROR: ${message}`);
      remaining.push({ file: marker.file, region: marker.region, reason: "pipeline_error", stage: "download_or_extraction", error: message });
    } finally {
      if (tempPath) fs.rmSync(tempPath, { force: true });
    }
  }

  const realExports = findSkipMarkers(EXPORTS_DIR); // re-count markers after recovery
  const summary = {
    total_drive_images_with_markers: allMarkers.length,
    attempted: markers.length,
    recovered,
    still_non_personnel: stillNonPersonnel,
    errors,
    markers_without_source_id: withoutId.length,
    markers_remaining: dryRun ? allMarkers.length : realExports.length,
    dry_run: dryRun,
  };

  console.log("------------------------------------------------");
  console.log("Completed");
  console.log(JSON.stringify(summary, null, 2));

  if (!dryRun) {
    writeJson(path.join(LOGS_DIR, "recovery_summary.json"), summary);
    writeJson(path.join(LOGS_DIR, "recovery_remaining.json"), remaining);
    console.log(`Summary saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "recovery_summary.json"))}`);
  }
}

main().catch((error) => {
  console.error("Recovery runner crashed:", error);
  process.exitCode = 1;
});
