/**
 * Unit tests for PrismaAssetRepository (Phase 19B) over the fake Asset DB
 * client — no live database. Verifies idempotent upsert, findById, filtered/
 * paginated list, facet counts, and the reserved-PROFILE DB-level exclusion.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/prisma_asset_repository.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FakeAssetDbClient } from "@/lib/gallery/__tests__/fake_asset_db";
import { PrismaAssetRepository } from "@/lib/gallery/prisma_asset_repository";
import { AssetCategory } from "@/lib/gallery/asset_category";
import type { Asset } from "@/lib/gallery/asset_types";

function asset(id: string, ov: Partial<Asset> = {}): Asset {
  return {
    assetId: id,
    category: AssetCategory.CompanyLocation,
    region: "ภาค 1",
    company: "ตชด.447",
    battalion: null,
    folderName: "แผนที่ตั้งกองร้อย",
    relativePath: `แผนที่ตั้งกองร้อย/ตชด.447/${id}.jpg`,
    driveFileId: id,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w2048`,
    webViewUrl: `https://drive.google.com/file/d/${id}/view`,
    imageWidth: null,
    imageHeight: null,
    createdTime: "2026-01-01T00:00:00.000Z",
    updatedTime: "2026-01-02T00:00:00.000Z",
    ...ov,
  };
}

function repo() {
  return new PrismaAssetRepository(new FakeAssetDbClient());
}

test("upsert is idempotent (create then update, no duplicate)", async () => {
  const r = repo();
  const first = await r.upsert(asset("a"));
  assert.equal(first.created, true);

  const second = await r.upsert(asset("a", { region: "ภาค 2" }));
  assert.equal(second.created, false);
  assert.equal(await r.count(), 1);

  const found = await r.findById("a");
  assert.equal(found?.region, "ภาค 2"); // updated in place
});

test("findById round-trips the asset (dates ↔ ISO strings)", async () => {
  const r = repo();
  await r.upsert(asset("a"));
  const found = await r.findById("a");
  assert.equal(found?.assetId, "a");
  assert.equal(found?.createdTime, "2026-01-01T00:00:00.000Z");
  assert.equal(found?.thumbnailUrl, "https://drive.google.com/thumbnail?id=a&sz=w2048");
});

test("list filters by category / region / company and paginates", async () => {
  const r = repo();
  await r.upsert(asset("a", { category: AssetCategory.NeighborMap, region: "ภาค 1", company: null }));
  await r.upsert(asset("b", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }));
  await r.upsert(asset("c", { category: AssetCategory.CompanyLocation, region: "ภาค 2", company: "ตชด.115" }));

  const byCat = await r.list({ category: AssetCategory.CompanyLocation });
  assert.equal(byCat.total, 2);

  const byRegion = await r.list({ category: AssetCategory.CompanyLocation, region: "ภาค 1" });
  assert.deepEqual(byRegion.data.map((a) => a.assetId), ["b"]);

  const page = await r.list({ pageSize: 2, page: 1 });
  assert.equal(page.data.length, 2);
  assert.equal(page.total, 3);
  assert.equal(page.totalPages, 2);
});

test("reserved PROFILE assets are never returned by list or facets", async () => {
  const r = repo();
  await r.upsert(asset("p", { category: AssetCategory.Profile }));
  await r.upsert(asset("m", { category: AssetCategory.OrgChart }));

  const all = await r.list({});
  assert.deepEqual(all.data.map((a) => a.assetId), ["m"]);

  const cats = await r.categoryCounts();
  assert.equal(cats.find((c) => c.category === AssetCategory.Profile), undefined);
  assert.equal(cats.find((c) => c.category === AssetCategory.OrgChart)?.count, 1);
});

test("category / region / company facet counts", async () => {
  const r = repo();
  await r.upsert(asset("a", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }));
  await r.upsert(asset("b", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }));
  await r.upsert(asset("c", { category: AssetCategory.CompanyLocation, region: "ภาค 2", company: "ตชด.115" }));

  const cats = await r.categoryCounts();
  assert.equal(cats.find((c) => c.category === AssetCategory.CompanyLocation)?.count, 3);

  const regions = await r.regionCounts(AssetCategory.CompanyLocation);
  assert.equal(regions.find((x) => x.value === "ภาค 1")?.count, 2);

  const companies = await r.companyCounts({ category: AssetCategory.CompanyLocation, region: "ภาค 1" });
  assert.deepEqual(companies, [{ value: "ตชด.447", count: 2 }]);
});

test("search matches folderName / relativePath (case-insensitive contains)", async () => {
  const r = repo();
  await r.upsert(asset("a", { category: AssetCategory.NeighborMap, folderName: "แผนที่หน่วยข้างเคียง ภาค 1", region: "ภาค 1", company: null }));
  await r.upsert(asset("b", { category: AssetCategory.OrgChart, folderName: "แผนผังโครงสร้าง", region: "ภาค 1", company: null }));
  const res = await r.list({ search: "โครงสร้าง" });
  assert.deepEqual(res.data.map((a) => a.assetId), ["b"]);
});
