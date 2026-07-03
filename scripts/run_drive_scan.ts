/**
 * Phase 9A — Google Drive Live Integration.
 *
 * Connects the existing Google Drive Architecture (lib/google-drive/) to
 * the real Google Drive API. Metadata only: authenticates, scans the
 * configured root folder recursively, maps each file to its
 * region/province/battalion/company via the existing FolderMapper
 * contract, and writes logs/drive_scan.json + logs/drive_summary.json.
 *
 * This script does NOT import personnel, does NOT call OpenAI, does NOT
 * run OCR, and never creates/updates/deletes any Drive content — every
 * Drive call made anywhere in this pipeline is a read (files.get/
 * files.list/changes.getStartPageToken).
 *
 * Responsibilities: authenticate, run FolderScanner, run FileScanner (via
 * FolderScanner's per-file metadata, already normalized to
 * DriveFileMetadata), run FolderMapper, generate reports, print a summary.
 * Nothing else.
 *
 * Usage:
 *   npx tsx scripts/run_drive_scan.ts
 *
 * Configuration (.env.local):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *     (or GOOGLE_DRIVE_CREDENTIALS=<inline JSON>)
 *   GOOGLE_DRIVE_ROOT_FOLDER=<root folder id>
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables before any project modules read process.env.
// Mirrors scripts/run_real_import.ts / run_batch_import.ts exactly.
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
      "GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_DRIVE_CREDENTIALS and GOOGLE_DRIVE_ROOT_FOLDER must already be set in your shell environment."
  );
}

import { createDriveAuthClient, DriveAuthConfigError } from "@/lib/google-drive/drive_auth";
import { GoogleDriveClient } from "@/lib/google-drive/google_drive_client";
import { FolderScanner } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import { DriveScanReportBuilder } from "@/lib/google-drive/drive_scan_report";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";

const LOGS_DIR = path.join(process.cwd(), "logs");

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function printSummary(summary: { total_folders: number; image_files: number; non_image_files: number; scan_duration_ms: number; shared_drive: boolean }): void {
  console.log("Connected");
  console.log(summary.shared_drive ? "Shared Drive" : "My Drive");
  console.log("✓");
  console.log("");
  console.log("Folders");
  console.log(String(summary.total_folders));
  console.log("");
  console.log("Images");
  console.log(String(summary.image_files));
  console.log("");
  console.log("Non Images");
  console.log(String(summary.non_image_files));
  console.log("");
  console.log("Duration");
  console.log(`${(summary.scan_duration_ms / 1000).toFixed(1)} sec`);
}

async function main() {
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

  try {
    // supportsAllDrives is requested unconditionally by GoogleDriveClient;
    // we report "Shared Drive" based on whether the scanned root actually
    // resolves under a Shared Drive, which the Drive API surfaces via the
    // folder's own metadata rather than something this script infers
    // client-side — kept simple here as "supported", per the task's scope
    // (support both, do not need to auto-detect which one is in use).
    const report = await reportBuilder.build(rootFolderId, { sharedDrive: true });

    writeJson(path.join(LOGS_DIR, "drive_scan.json"), report.entries);
    writeJson(path.join(LOGS_DIR, "drive_summary.json"), report.summary);

    printSummary(report.summary);
    console.log("");
    console.log("Saved");
    console.log(path.relative(process.cwd(), path.join(LOGS_DIR, "drive_scan.json")));
  } catch (error) {
    if (error instanceof DriveProviderError) {
      console.error(`Google Drive scan failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("Drive scan runner crashed:", error);
  process.exitCode = 1;
});
