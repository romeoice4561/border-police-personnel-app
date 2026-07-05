/**
 * Phase 18B: verifies DriveScanReportBuilder attaches the correct content_type
 * to each discovered image based on its TOP-LEVEL folder, and that nested
 * subfolders inherit it. Uses the in-memory fake DriveClient — no OCR, no
 * OpenAI, no network, no imports.
 *
 * Run with:
 *   npx tsx --test lib/google-drive/__tests__/drive_scan_content_type.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDriveClient } from "@/lib/google-drive/drive_client";
import { FolderScanner } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import { DriveScanReportBuilder } from "@/lib/google-drive/drive_scan_report";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import type { DriveFileMetadata, DriveFolder } from "@/lib/google-drive/drive_types";

function img(id: string, name: string, parent: string): DriveFileMetadata {
  return { id, name, mimeType: "image/jpeg", size: "1024", modifiedTime: "2026-01-01T00:00:00Z", parents: [parent] };
}

/**
 * Semantic tree mirroring the new Drive root:
 *   ROOT
 *     Profile รายบุคคล ภาค 1 (PROFILE)      → p1.jpg
 *     แผนที่หน่วยข้างเคียง ภาค 1 (NEIGHBOR_MAP) → n1.jpg
 *     แผนที่ตั้งกองร้อย (COMPANY_LOCATION)
 *        └── ตชด.447                          → c1.jpg  (nested → inherits COMPANY_LOCATION)
 *     Random Folder (UNKNOWN)                → u1.jpg
 */
function buildFake() {
  const F = (id: string, name: string, parent: string | null): DriveFolder => ({ id, name, parents: parent ? [parent] : [] });
  const folders = new Map<string, DriveFolder>([
    ["ROOT", F("ROOT", "root", null)],
    ["PROF", F("PROF", "Profile รายบุคคล ภาค 1", "ROOT")],
    ["NEIGH", F("NEIGH", "แผนที่หน่วยข้างเคียง ภาค 1", "ROOT")],
    ["COMP", F("COMP", "แผนที่ตั้งกองร้อย", "ROOT")],
    ["UNIT447", F("UNIT447", "ตชด.447", "COMP")],
    ["RAND", F("RAND", "Random Folder", "ROOT")],
  ]);
  const subfolders = new Map<string, DriveFolder[]>([
    ["ROOT", [folders.get("PROF")!, folders.get("NEIGH")!, folders.get("COMP")!, folders.get("RAND")!]],
    ["COMP", [folders.get("UNIT447")!]],
  ]);
  const files = new Map<string, DriveFileMetadata[]>([
    ["PROF", [img("p1", "p1.jpg", "PROF")]],
    ["NEIGH", [img("n1", "n1.jpg", "NEIGH")]],
    ["UNIT447", [img("c1", "c1.jpg", "UNIT447")]],
    ["RAND", [img("u1", "u1.jpg", "RAND")]],
  ]);
  return new InMemoryDriveClient(folders, files, subfolders);
}

async function buildReport() {
  const client = buildFake();
  const builder = new DriveScanReportBuilder({
    folderScanner: new FolderScanner(client),
    folderMapper: new DepthBasedFolderMapper({ rootFolderId: "ROOT" }),
  });
  return builder.build("ROOT", { sharedDrive: false });
}

test("each image gets the content_type of its top-level folder", async () => {
  const report = await buildReport();
  const byName = Object.fromEntries(report.entries.map((e) => [e.name, e]));

  assert.equal(byName["p1.jpg"].content_type, DriveContentType.Profile);
  assert.equal(byName["n1.jpg"].content_type, DriveContentType.NeighborMap);
  assert.equal(byName["u1.jpg"].content_type, DriveContentType.Unknown);
});

test("nested subfolder images inherit the top-level content_type", async () => {
  const report = await buildReport();
  const c1 = report.entries.find((e) => e.name === "c1.jpg")!;
  // c1 lives in ตชด.447 nested under แผนที่ตั้งกองร้อย → COMPANY_LOCATION.
  assert.equal(c1.content_type, DriveContentType.CompanyLocation);
  assert.equal(c1.top_level_folder, "แผนที่ตั้งกองร้อย");
});

test("summary tallies image files per content type", async () => {
  const report = await buildReport();
  assert.equal(report.summary.content_types[DriveContentType.Profile], 1);
  assert.equal(report.summary.content_types[DriveContentType.NeighborMap], 1);
  assert.equal(report.summary.content_types[DriveContentType.CompanyLocation], 1);
  assert.equal(report.summary.content_types[DriveContentType.Unknown], 1);
  assert.equal(report.summary.content_types[DriveContentType.OrgChart], 0);
});
