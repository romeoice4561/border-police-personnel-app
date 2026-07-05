/**
 * Unit tests for AssetBuilder + category mapping (Phase 19A). Pure — maps a
 * DriveScanEntry to an Asset, no OCR/AI/network.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/asset_builder.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { assetFromScanEntry, assetsFromScanEntries, folderChainFromRelativePath } from "@/lib/gallery/asset_builder";
import { AssetCategory, assetCategoryFromContentType } from "@/lib/gallery/asset_category";

function entry(ov: Partial<DriveScanEntry> = {}): DriveScanEntry {
  return {
    id: "FILE1",
    name: "c1.jpg",
    mimeType: "image/jpeg",
    size: "1024",
    modifiedTime: "2026-02-02T00:00:00Z",
    createdTime: "2026-01-01T00:00:00Z",
    parentFolder: "P",
    relativePath: "แผนที่ตั้งกองร้อย/ตชด.447/c1.jpg",
    isImage: true,
    content_type: DriveContentType.CompanyLocation,
    top_level_folder: "แผนที่ตั้งกองร้อย",
    ...ov,
  };
}

test("assetCategoryFromContentType maps every content type losslessly", () => {
  assert.equal(assetCategoryFromContentType(DriveContentType.Profile), AssetCategory.Profile);
  assert.equal(assetCategoryFromContentType(DriveContentType.NeighborMap), AssetCategory.NeighborMap);
  assert.equal(assetCategoryFromContentType(DriveContentType.OrgChart), AssetCategory.OrgChart);
  assert.equal(assetCategoryFromContentType(DriveContentType.DeploymentMap), AssetCategory.DeploymentMap);
  assert.equal(assetCategoryFromContentType(DriveContentType.CompanyLocation), AssetCategory.CompanyLocation);
  assert.equal(assetCategoryFromContentType(DriveContentType.BattalionLocation), AssetCategory.BattalionLocation);
  assert.equal(assetCategoryFromContentType(DriveContentType.Unknown), AssetCategory.Unknown);
});

test("folderChainFromRelativePath drops the filename", () => {
  assert.deepEqual(folderChainFromRelativePath("แผนที่ตั้งกองร้อย/ตชด.447/c1.jpg"), ["แผนที่ตั้งกองร้อย", "ตชด.447"]);
  assert.deepEqual(folderChainFromRelativePath("solo.jpg"), []);
});

test("assetFromScanEntry maps a company-location asset with parsed placement + derived URLs", () => {
  const asset = assetFromScanEntry(entry());
  assert.equal(asset.assetId, "FILE1");
  assert.equal(asset.category, AssetCategory.CompanyLocation);
  assert.equal(asset.company, "ตชด.447"); // parsed from the nested subfolder
  assert.equal(asset.battalion, null);
  assert.equal(asset.folderName, "แผนที่ตั้งกองร้อย");
  assert.equal(asset.driveFileId, "FILE1");
  assert.match(asset.thumbnailUrl ?? "", /thumbnail\?id=FILE1/); // derived, no API call
  assert.match(asset.webViewUrl ?? "", /file\/d\/FILE1\/view/);
  assert.equal(asset.createdTime, "2026-01-01T00:00:00Z");
  assert.equal(asset.updatedTime, "2026-02-02T00:00:00Z");
  // No OCR/AI fields exist on the model.
  assert.equal("confidence" in asset, false);
  assert.equal("timeline" in asset, false);
});

test("assetFromScanEntry prefers the scanner's resolved region/company, falling back to parsing", () => {
  const withResolved = assetFromScanEntry(entry({ region: "ภาค 1", company: "ตชด.999" }));
  assert.equal(withResolved.region, "ภาค 1");
  assert.equal(withResolved.company, "ตชด.999");
});

test("assetFromScanEntry parses a battalion asset", () => {
  const asset = assetFromScanEntry(
    entry({
      relativePath: "แผนที่ตั้ง กองกำกับ ตชด/กก.ตชด.44/b1.jpg",
      top_level_folder: "แผนที่ตั้ง กองกำกับ ตชด",
      content_type: DriveContentType.BattalionLocation,
    })
  );
  assert.equal(asset.category, AssetCategory.BattalionLocation);
  assert.equal(asset.battalion, "กก.ตชด.44");
  assert.equal(asset.company, null);
});

test("assetsFromScanEntries keeps only image files", () => {
  const assets = assetsFromScanEntries([
    entry({ id: "IMG", isImage: true }),
    entry({ id: "PDF", name: "notes.pdf", isImage: false, content_type: DriveContentType.Unknown }),
  ]);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].assetId, "IMG");
});
