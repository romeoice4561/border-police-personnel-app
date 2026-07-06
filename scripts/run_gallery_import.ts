/**
 * Gallery Import Runner (Phase 19E — Production Activation).
 *
 * Activates the Gallery by wiring the existing Drive scanner → GalleryImporter
 * → Asset table pipeline. Nothing here is new logic — every building block
 * (Drive auth, FolderScanner, DriveScanReportBuilder, assetsFromScanEntries,
 * GalleryContainer, AssetService.ingest) was built in earlier phases; this
 * script is ONLY the runner that connects them.
 *
 * Pipeline:
 *   GoogleDriveClient + FolderScanner
 *     → DriveScanReportBuilder.build()   (metadata only — no downloads)
 *     → DriveScanEntry[]
 *     → assetsFromScanEntries()          (images only)
 *     → filter(!PROFILE)                 (PROFILE always excluded)
 *     → AssetService.ingest() in batches (idempotent upsert by assetId)
 *     → Asset table in Supabase
 *
 * Safety guarantees:
 *   - PROFILE assets are NEVER imported (two independent guards: the pre-filter
 *     here, and AssetService.ingest which also skips reserved categories).
 *   - Idempotent: running this script N times creates no duplicates (assets
 *     upsert by deterministic assetId).
 *   - Read-only against Drive: no file is downloaded, created, or modified.
 *   - No officer tables, no OCR, no OpenAI, no existing APIs touched.
 *
 * Usage:
 *   npx tsx scripts/run_gallery_import.ts
 *   npx tsx scripts/run_gallery_import.ts --dry-run   # scan only, no DB writes
 *
 * Configuration (.env.local):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *     (or GOOGLE_DRIVE_CREDENTIALS=<inline JSON>)
 *   GOOGLE_DRIVE_ROOT_FOLDER=<root folder id>
 *   DATABASE_URL=<Supabase connection string>
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// ── Environment loading ──────────────────────────────────────────────────────
// Must happen before any project module reads process.env; mirrors all other
// scripts in this directory exactly.
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
      "GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_DRIVE_CREDENTIALS and GOOGLE_DRIVE_ROOT_FOLDER must already be set."
  );
}

// ── Project imports (after dotenv) ──────────────────────────────────────────
import { createDriveAuthClient, DriveAuthConfigError } from "@/lib/google-drive/drive_auth";
import { GoogleDriveClient } from "@/lib/google-drive/google_drive_client";
import { FolderScanner } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import { DriveScanReportBuilder } from "@/lib/google-drive/drive_scan_report";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";
import { assetsFromScanEntries } from "@/lib/gallery/asset_builder";
import { isReservedCategory, ASSET_CATEGORY_LABELS, GALLERY_CATEGORIES } from "@/lib/gallery/asset_category";
import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import type { Asset } from "@/lib/gallery/asset_types";

// ── Constants ────────────────────────────────────────────────────────────────
const PROGRESS_BATCH = 50;
const LOGS_DIR = path.join(process.cwd(), "logs");

// ── Helpers ──────────────────────────────────────────────────────────────────
function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function isDryRun(): boolean {
  return process.argv.includes("--dry-run");
}

function printHeader(): void {
  console.log("================================================");
  console.log("Border Police Gallery Import — Phase 19E");
  console.log("================================================");
  if (isDryRun()) console.log("[DRY RUN — no database writes]");
  console.log("");
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  printHeader();

  const startedAt = Date.now();

  // ── 1. Config validation ─────────────────────────────────────────────────
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER;
  if (!rootFolderId) {
    console.error("GOOGLE_DRIVE_ROOT_FOLDER is not set. Add it to .env.local, then re-run.");
    process.exitCode = 1;
    return;
  }

  // ── 2. Drive authentication ──────────────────────────────────────────────
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

  // ── 3. Discovery — metadata only, no downloads ──────────────────────────
  console.log("Scanning Google Drive (metadata only)...");
  const client = new GoogleDriveClient({ auth, supportsSharedDrives: true });
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId });
  const reportBuilder = new DriveScanReportBuilder({ folderScanner, folderMapper });

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

  const { entries, summary: scanSummary } = scanReport;

  console.log(
    `Scan complete — ${entries.length} entries, ${scanSummary.image_files} image(s), ` +
      `${scanSummary.total_folders} folder(s), ${(scanSummary.scan_duration_ms / 1000).toFixed(1)}s`
  );
  console.log("");

  // ── 4. Filter: images only, PROFILE excluded ─────────────────────────────
  const allImageAssets: Asset[] = assetsFromScanEntries(entries);
  const profileIgnored = allImageAssets.filter((a) => isReservedCategory(a.category)).length;
  const galleryAssets = allImageAssets.filter((a) => !isReservedCategory(a.category));

  console.log(`Discovered:       ${entries.length}`);
  console.log(`Images:           ${allImageAssets.length}`);
  console.log(`Profile ignored:  ${profileIgnored}`);
  console.log(`Gallery assets:   ${galleryAssets.length}`);
  console.log("");

  if (galleryAssets.length === 0) {
    console.log("No gallery assets to import. Verify that GOOGLE_DRIVE_ROOT_FOLDER points to the correct Drive.");
    return;
  }

  if (isDryRun()) {
    console.log("[DRY RUN] Skipping database writes. Gallery assets ready for import:");
    printCategoryBreakdown(galleryAssets);
    return;
  }

  // ── 5. Gallery container (Prisma-backed Supabase) ────────────────────────
  let container;
  try {
    container = await getGalleryContainer();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to connect to the database: ${msg}`);
    process.exitCode = 1;
    return;
  }

  // ── 6. Batch ingest with progress ────────────────────────────────────────
  console.log(`Importing ${galleryAssets.length} gallery assets...`);
  let totalCreated = 0;
  let totalUpdated = 0;

  for (let offset = 0; offset < galleryAssets.length; offset += PROGRESS_BATCH) {
    const batch = galleryAssets.slice(offset, offset + PROGRESS_BATCH);
    const result = await container.service.ingest(batch);
    totalCreated += result.created;
    totalUpdated += result.updated;

    const imported = Math.min(offset + PROGRESS_BATCH, galleryAssets.length);
    console.log(`Imported ${imported} / ${galleryAssets.length}`);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log("");
  console.log("Gallery Import Complete");
  console.log("─────────────────────────────────────────");
  console.log(`Discovered:       ${entries.length}`);
  console.log(`Images:           ${allImageAssets.length}`);
  console.log(`Profile ignored:  ${profileIgnored}`);
  console.log(`Gallery imported: ${galleryAssets.length}`);
  console.log(`Created:          ${totalCreated}`);
  console.log(`Updated:          ${totalUpdated}`);
  console.log(`Elapsed:          ${elapsedSec} sec`);
  console.log("");

  // ── 8. Category breakdown ─────────────────────────────────────────────────
  console.log("Category breakdown (from import):");
  printCategoryBreakdown(galleryAssets);
  console.log("");

  // ── 9. Category verification — live query from Asset table ────────────────
  console.log("Category verification (live DB query):");
  console.log("─────────────────────────────────────────");
  let dbCategories;
  try {
    dbCategories = await container.service.categoryCounts();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Category query failed: ${msg}`);
    dbCategories = null;
  }

  if (dbCategories) {
    const dbMap = Object.fromEntries(dbCategories.map((c) => [c.category, c.count]));
    for (const cat of GALLERY_CATEGORIES) {
      const count = dbMap[cat] ?? 0;
      const label = ASSET_CATEGORY_LABELS[cat];
      console.log(`  ${label.padEnd(28)} ${count}`);
    }
    const dbTotal = dbCategories.reduce((s, c) => s + c.count, 0);
    console.log(`  ${"Total".padEnd(28)} ${dbTotal}`);
  }
  console.log("");

  // ── 10. API-level service validation ─────────────────────────────────────
  console.log("Service validation:");
  console.log("─────────────────────────────────────────");

  // Validate categoryCounts()
  try {
    const cats = await container.service.categoryCounts();
    const total = cats.reduce((s, c) => s + c.count, 0);
    console.log(`  ✓ categoryCounts()  — ${cats.length} category(s), ${total} total asset(s)`);
  } catch (error) {
    console.log(`  ✗ categoryCounts()  — ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate list() (first page)
  try {
    const page = await container.service.list({ page: 1, pageSize: 10 });
    if (page.total > 0) {
      console.log(`  ✓ list()            — ${page.total} total, page 1: ${page.data.length} item(s), totalPages: ${page.totalPages}`);
    } else {
      console.log(`  ✗ list()            — returned 0 assets (expected > 0 after import)`);
    }
  } catch (error) {
    console.log(`  ✗ list()            — ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate regionCounts()
  try {
    const regions = await container.service.regionCounts();
    console.log(`  ✓ regionCounts()    — ${regions.length} region(s)`);
  } catch (error) {
    console.log(`  ✗ regionCounts()    — ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate companyCounts()
  try {
    const companies = await container.service.companyCounts();
    console.log(`  ✓ companyCounts()   — ${companies.length} company(s)`);
  } catch (error) {
    console.log(`  ✗ companyCounts()   — ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("");

  // ── 11. Save logs ─────────────────────────────────────────────────────────
  const logSummary = {
    timestamp: new Date().toISOString(),
    discovered: entries.length,
    images: allImageAssets.length,
    profile_ignored: profileIgnored,
    gallery_assets: galleryAssets.length,
    created: totalCreated,
    updated: totalUpdated,
    elapsed_sec: Number(elapsedSec),
    scan: scanSummary,
    db_categories: dbCategories ?? null,
  };
  writeJson(path.join(LOGS_DIR, "gallery_import_summary.json"), logSummary);
  console.log(`Log saved to ${path.relative(process.cwd(), path.join(LOGS_DIR, "gallery_import_summary.json"))}`);

  // ── 12. UI verification checklist ────────────────────────────────────────
  console.log("");
  console.log("UI verification checklist:");
  console.log("  1. Open /gallery in the browser");
  console.log("  2. Verify category cards show correct asset counts");
  console.log("  3. Click a category → assets appear in the grid");
  console.log("  4. Test Region filter → grid updates");
  console.log("  5. Test Company filter → grid narrows");
  console.log("  6. Type in Search → matching assets shown");
  console.log("  7. Click an asset card → PhotoModal opens");
  console.log("  8. Zoom, pan, pinch in the viewer");
  console.log("  9. Verify 'Open in Google Drive' link works");
  console.log(" 10. Press Esc to close modal");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Prints a per-category count table for the in-memory gallery asset list. */
function printCategoryBreakdown(assets: Asset[]): void {
  const byCategory: Record<string, number> = {};
  for (const a of assets) {
    byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
  }
  for (const cat of GALLERY_CATEGORIES) {
    const count = byCategory[cat] ?? 0;
    const label = ASSET_CATEGORY_LABELS[cat];
    console.log(`  ${label.padEnd(28)} ${count}`);
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────
main().catch((error) => {
  console.error("Gallery import runner crashed:", error);
  process.exitCode = 1;
});
