/**
 * Unit tests for GalleryImporter (Phase 19B) — end to end through the real
 * AssetBuilder → AssetService → PrismaAssetRepository over the fake Asset DB.
 * Verifies PROFILE is ignored, non-images are dropped, ingest is idempotent,
 * and the summary is correct. No live database, no OCR/OpenAI.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/gallery_importer.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FakeAssetDbClient } from "@/lib/gallery/__tests__/fake_asset_db";
import { PrismaAssetRepository } from "@/lib/gallery/prisma_asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
import { GalleryImporter } from "@/lib/gallery/gallery_importer";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import { AssetCategory } from "@/lib/gallery/asset_category";
import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";

function entry(ov: Partial<DriveScanEntry> & { id: string }): DriveScanEntry {
  return {
    name: `${ov.id}.jpg`,
    mimeType: "image/jpeg",
    size: "1024",
    modifiedTime: "2026-02-02T00:00:00Z",
    createdTime: "2026-01-01T00:00:00Z",
    parentFolder: "P",
    relativePath: `แผนที่ตั้งกองร้อย/ตชด.447/${ov.id}.jpg`,
    isImage: true,
    content_type: DriveContentType.CompanyLocation,
    top_level_folder: "แผนที่ตั้งกองร้อย",
    ...ov,
  };
}

function makeImporter() {
  const db = new FakeAssetDbClient();
  const repository = new PrismaAssetRepository(db);
  const service = new AssetService({ repository });
  return { importer: new GalleryImporter({ service }), repository, db };
}

test("imports non-profile assets and ignores PROFILE + non-images", async () => {
  const { importer, db } = makeImporter();

  const summary = await importer.import([
    entry({ id: "map1", content_type: DriveContentType.NeighborMap, relativePath: "แผนที่หน่วยข้างเคียง ภาค 1/map1.jpg", top_level_folder: "แผนที่หน่วยข้างเคียง ภาค 1" }),
    entry({ id: "org1", content_type: DriveContentType.OrgChart, relativePath: "แผนผังโครงสร้าง/org1.jpg", top_level_folder: "แผนผังโครงสร้าง" }),
    entry({ id: "prof1", content_type: DriveContentType.Profile, relativePath: "Profile ภาค 1/prof1.jpg", top_level_folder: "Profile ภาค 1" }),
    entry({ id: "pdf1", name: "doc.pdf", mimeType: "application/pdf", isImage: false, content_type: DriveContentType.Unknown }),
  ]);

  assert.equal(summary.discovered, 4);
  assert.equal(summary.images, 3); // non-image PDF excluded by the builder
  assert.equal(summary.profile_ignored, 1); // the profile image dropped
  assert.equal(summary.assets_created, 2); // map1 + org1
  assert.equal(summary.assets_updated, 0);
  assert.equal(db.size(), 2); // no profile row persisted
  assert.equal(summary.by_category[AssetCategory.NeighborMap], 1);
  assert.equal(summary.by_category[AssetCategory.OrgChart], 1);
  assert.equal(summary.by_category[AssetCategory.Profile], undefined);
});

test("IDEMPOTENT: re-importing the same entries creates no duplicates", async () => {
  const { importer, repository } = makeImporter();
  const entries = [
    entry({ id: "a", relativePath: "แผนที่ตั้งกองร้อย/ตชด.447/a.jpg" }),
    entry({ id: "b", relativePath: "แผนที่ตั้งกองร้อย/ตชด.447/b.jpg" }),
  ];

  const first = await importer.import(entries);
  assert.equal(first.assets_created, 2);

  const second = await importer.import(entries);
  assert.equal(second.assets_created, 0);
  assert.equal(second.assets_updated, 2);
  assert.equal(await repository.count(), 2); // unchanged — idempotent
});

test("persisted assets carry parsed placement + derived Drive URLs (no OCR fields)", async () => {
  const { importer, repository } = makeImporter();
  await importer.import([entry({ id: "c1" })]);

  const listed = await repository.list({ category: AssetCategory.CompanyLocation });
  const a = listed.data[0];
  assert.equal(a.company, "ตชด.447"); // parsed from folder hierarchy
  assert.equal(a.category, AssetCategory.CompanyLocation);
  assert.match(a.thumbnailUrl ?? "", /thumbnail\?id=c1/);
  assert.match(a.webViewUrl ?? "", /file\/d\/c1\/view/);
  assert.equal("confidence" in a, false); // no OCR/AI fields
});
