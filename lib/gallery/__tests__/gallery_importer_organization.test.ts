/**
 * GalleryImporter organization-linking tests (Phase 20B).
 *
 * Verifies that injecting an OrganizationService resolves each asset's
 * existing `company` text to a registered Company's id (companyId), that an
 * unresolved code leaves companyId null and is recorded for review, and that
 * omitting the dependency reproduces Phase 19B behavior exactly (no
 * companyId, no organization coupling) — full backward compatibility.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/gallery_importer_organization.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FakeAssetDbClient } from "@/lib/gallery/__tests__/fake_asset_db";
import { PrismaAssetRepository } from "@/lib/gallery/prisma_asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
import { GalleryImporter } from "@/lib/gallery/gallery_importer";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";

import { InMemoryOrganizationRepository } from "@/lib/organization/organization_repository";
import { OrganizationService } from "@/lib/organization/organization_service";
import { seedOrganization } from "@/lib/organization/organization_seed";

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

async function makeLinkedImporter() {
  const db = new FakeAssetDbClient();
  const repository = new PrismaAssetRepository(db);
  const service = new AssetService({ repository });

  const orgRepository = new InMemoryOrganizationRepository();
  await seedOrganization(orgRepository);
  const organizationService = new OrganizationService({ repository: orgRepository });

  return { importer: new GalleryImporter({ service, organizationService }), repository, organizationService };
}

test("without an OrganizationService, companyId is never set (Phase 19B behavior unchanged)", async () => {
  const db = new FakeAssetDbClient();
  const repository = new PrismaAssetRepository(db);
  const service = new AssetService({ repository });
  const importer = new GalleryImporter({ service });

  const summary = await importer.import([entry({ id: "c1" })]);
  assert.equal(summary.organization_linked, 0);

  const listed = await repository.findById("c1");
  assert.equal(listed?.companyId ?? null, null);
});

test("with an OrganizationService, a registered company code resolves to companyId", async () => {
  const { importer, repository, organizationService } = await makeLinkedImporter();

  const summary = await importer.import([entry({ id: "c1" })]); // folder implies ตชด.447 → registered
  assert.equal(summary.organization_linked, 1);

  const asset = await repository.findById("c1");
  const expectedCompany = await organizationService.findCompany("447");
  assert.equal(asset?.companyId, expectedCompany?.id);
});

test("an unresolved (unregistered) company code leaves companyId null and is recorded for review", async () => {
  const { importer, repository, organizationService } = await makeLinkedImporter();

  const summary = await importer.import([
    entry({ id: "u1", relativePath: "แผนที่ตั้งกองร้อย/ตชด.999/u1.jpg" }), // 999 not seeded
  ]);
  assert.equal(summary.organization_linked, 0);

  const asset = await repository.findById("u1");
  assert.equal(asset?.companyId ?? null, null);
  assert.equal(asset?.company, "ตชด.999"); // text field untouched either way

  const unresolved = await organizationService.listUnresolved("gallery_importer");
  assert.ok(unresolved.some((u) => u.raw === "ตชด.999"));
});

test("organization linking never alters the existing region/company/battalion text fields", async () => {
  const { importer, repository } = await makeLinkedImporter();
  await importer.import([entry({ id: "c1" })]);

  const asset = await repository.findById("c1");
  assert.equal(asset?.company, "ตชด.447");
  assert.equal(asset?.battalion, null); // asset_builder doesn't set battalion for this fixture; unchanged either way
});
