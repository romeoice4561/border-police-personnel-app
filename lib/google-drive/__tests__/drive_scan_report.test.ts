/**
 * Unit tests for Phase 9A's Google Drive live-integration reporting layer,
 * using fakes only — no real Google credentials or network calls.
 *
 * Run with: npx tsx --test lib/google-drive/__tests__/drive_scan_report.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDriveClient } from "@/lib/google-drive/drive_client";
import { FolderScanner } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import { DriveScanReportBuilder } from "@/lib/google-drive/drive_scan_report";
import type { DriveFileMetadata, DriveFolder } from "@/lib/google-drive/drive_types";

/**
 * Builds a small fake Drive tree:
 *   root (ROOT)
 *     ภาค1 (REGION1)
 *       officer1.jpg, notes.pdf
 *       บก.1 (PROVINCE1)
 *         officer2.png
 *     ภาค2 (REGION2)
 *       officer3.jpg
 */
function buildFakeDriveClient() {
  const rootId = "ROOT";
  const region1Id = "REGION1";
  const region2Id = "REGION2";
  const province1Id = "PROVINCE1";

  const folders = new Map<string, DriveFolder>([
    [rootId, { id: rootId, name: "root", parents: [] }],
    [region1Id, { id: region1Id, name: "ภาค1", parents: [rootId] }],
    [region2Id, { id: region2Id, name: "ภาค2", parents: [rootId] }],
    [province1Id, { id: province1Id, name: "บก.1", parents: [region1Id] }],
  ]);

  const subfoldersByFolder = new Map<string, DriveFolder[]>([
    [rootId, [folders.get(region1Id)!, folders.get(region2Id)!]],
    [region1Id, [folders.get(province1Id)!]],
  ]);

  const filesByFolder = new Map<string, DriveFileMetadata[]>([
    [
      region1Id,
      [
        {
          id: "f-officer1",
          name: "officer1.jpg",
          mimeType: "image/jpeg",
          size: "1024",
          modifiedTime: "2026-01-01T00:00:00Z",
          createdTime: "2025-12-01T00:00:00Z",
          md5Checksum: "abc123",
          parents: [region1Id],
        },
        {
          id: "f-notes",
          name: "notes.pdf",
          mimeType: "application/pdf",
          size: "2048",
          modifiedTime: "2026-01-02T00:00:00Z",
          parents: [region1Id],
        },
      ],
    ],
    [
      province1Id,
      [
        {
          id: "f-officer2",
          name: "officer2.png",
          mimeType: "image/png",
          size: "512",
          modifiedTime: "2026-01-03T00:00:00Z",
          parents: [province1Id],
        },
      ],
    ],
    [
      region2Id,
      [
        {
          id: "f-officer3",
          name: "officer3.jpg",
          mimeType: "image/jpeg",
          size: "4096",
          modifiedTime: "2026-01-04T00:00:00Z",
          parents: [region2Id],
        },
      ],
    ],
  ]);

  return { client: new InMemoryDriveClient(folders, filesByFolder, subfoldersByFolder), rootId };
}

test("DriveScanReportBuilder discovers every file across the whole tree", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  assert.equal(report.entries.length, 4);
  assert.equal(report.summary.total_files, 4);
});

test("DriveScanReportBuilder correctly separates image and non-image files", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  assert.equal(report.summary.image_files, 3);
  assert.equal(report.summary.non_image_files, 1);

  const pdfEntry = report.entries.find((e) => e.name === "notes.pdf");
  assert.ok(pdfEntry);
  assert.equal(pdfEntry!.isImage, false);

  const imageEntry = report.entries.find((e) => e.name === "officer1.jpg");
  assert.ok(imageEntry);
  assert.equal(imageEntry!.isImage, true);
});

test("DriveScanReportBuilder resolves region/province via DepthBasedFolderMapper", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  const officer1 = report.entries.find((e) => e.name === "officer1.jpg")!;
  assert.equal(officer1.region, "ภาค1");
  assert.equal(officer1.province, undefined);

  const officer2 = report.entries.find((e) => e.name === "officer2.png")!;
  assert.equal(officer2.region, "ภาค1");
  assert.equal(officer2.province, "บก.1");

  const officer3 = report.entries.find((e) => e.name === "officer3.jpg")!;
  assert.equal(officer3.region, "ภาค2");
});

test("DriveScanReportBuilder preserves full file metadata including createdTime and md5Checksum", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  const officer1 = report.entries.find((e) => e.name === "officer1.jpg")!;
  assert.equal(officer1.id, "f-officer1");
  assert.equal(officer1.mimeType, "image/jpeg");
  assert.equal(officer1.size, "1024");
  assert.equal(officer1.createdTime, "2025-12-01T00:00:00Z");
  assert.equal(officer1.modifiedTime, "2026-01-01T00:00:00Z");
  assert.equal(officer1.md5Checksum, "abc123");
  assert.equal(officer1.parentFolder, "REGION1");
});

test("DriveScanReportBuilder builds relative paths reflecting folder nesting", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  const officer2 = report.entries.find((e) => e.name === "officer2.png")!;
  assert.equal(officer2.relativePath, "ภาค1/บก.1/officer2.png");

  const officer1 = report.entries.find((e) => e.name === "officer1.jpg")!;
  assert.equal(officer1.relativePath, "ภาค1/officer1.jpg");
});

test("DriveScanReportBuilder counts every folder, including the root and nested subfolders", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  // root + ภาค1 + ภาค2 + บก.1 = 4 folders
  assert.equal(report.summary.total_folders, 4);
});

test("DriveScanReportBuilder summary lists distinct discovered regions", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: false });

  assert.deepEqual(report.summary.regions, ["ภาค1", "ภาค2"]);
});

test("DriveScanReportBuilder records shared_drive flag as provided", async () => {
  const { client, rootId } = buildFakeDriveClient();
  const folderScanner = new FolderScanner(client);
  const folderMapper = new DepthBasedFolderMapper({ rootFolderId: rootId });
  const builder = new DriveScanReportBuilder({ folderScanner, folderMapper });

  const report = await builder.build(rootId, { sharedDrive: true });
  assert.equal(report.summary.shared_drive, true);
});
