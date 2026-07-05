/**
 * Unit tests for the Asset repository + service (Phase 19A). Uses the in-memory
 * repository (the deferred-DB stand-in). Verifies filtering, facets, pagination,
 * idempotent ingest, and the reserved-PROFILE exclusion. No DB, no OCR/AI.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/asset_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryAssetRepository } from "@/lib/gallery/asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
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
    createdTime: "2026-01-01T00:00:00Z",
    updatedTime: "2026-01-02T00:00:00Z",
    ...ov,
  };
}

function service(seed: Asset[] = []) {
  return new AssetService({ repository: new InMemoryAssetRepository(seed) });
}

test("ingest is idempotent — re-ingesting the same assets creates no duplicates", async () => {
  const repo = new InMemoryAssetRepository();
  const svc = new AssetService({ repository: repo });
  const batch = [asset("a"), asset("b")];

  const first = await svc.ingest(batch);
  assert.deepEqual(first, { created: 2, updated: 0, skippedReserved: 0 });

  const second = await svc.ingest(batch);
  assert.deepEqual(second, { created: 0, updated: 2, skippedReserved: 0 });
  assert.equal(await repo.count(), 2);
});

test("ingest skips reserved PROFILE assets (they are not Gallery content)", async () => {
  const svc = service();
  const result = await svc.ingest([asset("p", { category: AssetCategory.Profile }), asset("m", { category: AssetCategory.OrgChart })]);
  assert.equal(result.skippedReserved, 1);
  assert.equal(result.created, 1);
});

test("list filters by category, region, and company", async () => {
  const svc = service([
    asset("a", { category: AssetCategory.NeighborMap, region: "ภาค 1", company: null }),
    asset("b", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }),
    asset("c", { category: AssetCategory.CompanyLocation, region: "ภาค 2", company: "ตชด.115" }),
  ]);

  const byCat = await svc.list({ category: AssetCategory.CompanyLocation });
  assert.equal(byCat.total, 2);

  const byRegion = await svc.list({ category: AssetCategory.CompanyLocation, region: "ภาค 1" });
  assert.deepEqual(byRegion.data.map((a) => a.assetId), ["b"]);

  const byCompany = await svc.list({ company: "ตชด.115" });
  assert.deepEqual(byCompany.data.map((a) => a.assetId), ["c"]);
});

test("list paginates", async () => {
  const seed = Array.from({ length: 30 }, (_, i) => asset(`a${String(i).padStart(2, "0")}`));
  const svc = service(seed);
  const page1 = await svc.list({ page: 1, pageSize: 24 });
  assert.equal(page1.data.length, 24);
  assert.equal(page1.total, 30);
  assert.equal(page1.totalPages, 2);
  const page2 = await svc.list({ page: 2, pageSize: 24 });
  assert.equal(page2.data.length, 6);
});

test("requesting the reserved PROFILE category returns an empty page", async () => {
  const svc = service([asset("p", { category: AssetCategory.Profile })]);
  const res = await svc.list({ category: AssetCategory.Profile });
  assert.equal(res.total, 0);
  assert.equal(res.data.length, 0);
});

test("getById never returns a reserved PROFILE asset via the Gallery", async () => {
  const svc = service([asset("p", { category: AssetCategory.Profile }), asset("m", { category: AssetCategory.OrgChart })]);
  assert.equal(await svc.getById("p"), null);
  assert.equal((await svc.getById("m"))?.assetId, "m");
});

test("category / region / company facet counts drive the filter flow", async () => {
  const svc = service([
    asset("a", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }),
    asset("b", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }),
    asset("c", { category: AssetCategory.CompanyLocation, region: "ภาค 2", company: "ตชด.115" }),
    asset("d", { category: AssetCategory.NeighborMap, region: "ภาค 1", company: null }),
    asset("p", { category: AssetCategory.Profile }), // reserved — excluded from all facets
  ]);

  const cats = await svc.categoryCounts();
  assert.equal(cats.find((c) => c.category === AssetCategory.CompanyLocation)?.count, 3);
  assert.equal(cats.find((c) => c.category === AssetCategory.Profile), undefined); // reserved excluded

  const regions = await svc.regionCounts(AssetCategory.CompanyLocation);
  assert.equal(regions.find((r) => r.value === "ภาค 1")?.count, 2);

  const companies = await svc.companyCounts({ category: AssetCategory.CompanyLocation, region: "ภาค 1" });
  assert.deepEqual(companies, [{ value: "ตชด.447", count: 2 }]);
});
