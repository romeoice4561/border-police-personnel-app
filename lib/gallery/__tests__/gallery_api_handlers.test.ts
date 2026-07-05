/**
 * Gallery API handler tests (Phase 19C) over the real AssetService +
 * InMemoryAssetRepository — no running server, no live DB. Verifies the
 * response envelopes (items / pagination / facetCounts), that filtering stays
 * in the service, PROFILE exclusion, 404, and 400 validation.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/gallery_api_handlers.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryAssetRepository } from "@/lib/gallery/asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
import { AssetCategory } from "@/lib/gallery/asset_category";
import type { Asset } from "@/lib/gallery/asset_types";
import {
  handleGalleryAssets,
  handleGalleryAssetById,
  handleGalleryCategories,
  handleGalleryRegions,
  handleGalleryCompanies,
} from "@/lib/gallery/gallery_api_handlers";

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

function service(seed: Asset[]) {
  return new AssetService({ repository: new InMemoryAssetRepository(seed) });
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

const SEED: Asset[] = [
  asset("a", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }),
  asset("b", { category: AssetCategory.CompanyLocation, region: "ภาค 1", company: "ตชด.447" }),
  asset("c", { category: AssetCategory.CompanyLocation, region: "ภาค 2", company: "ตชด.115" }),
  asset("d", { category: AssetCategory.NeighborMap, region: "ภาค 1", company: null, folderName: "แผนที่หน่วยข้างเคียง ภาค 1" }),
  asset("p", { category: AssetCategory.Profile }), // reserved — must never appear
];

test("GET /assets returns items + pagination + facetCounts", async () => {
  const res = await handleGalleryAssets(service(SEED), new URLSearchParams("pageSize=2"));
  assert.equal(res.status, 200);
  const json = await body(res);
  const items = json.data as unknown[];
  const meta = json.meta as Record<string, Record<string, unknown>>;

  assert.equal(items.length, 2);
  assert.equal(meta.pagination.total, 4); // PROFILE excluded from the 5 seeded
  assert.equal(meta.pagination.totalPages, 2);
  assert.ok(Array.isArray(meta.facetCounts.categories));
  assert.ok(Array.isArray(meta.facetCounts.regions));
  assert.ok(Array.isArray(meta.facetCounts.companies));
});

test("GET /assets filters by category + region (filtering stays in the service)", async () => {
  const res = await handleGalleryAssets(service(SEED), new URLSearchParams("category=COMPANY_LOCATION&region=ภาค 1"));
  const items = ((await body(res)).data as Array<{ assetId: string }>).map((a) => a.assetId).sort();
  assert.deepEqual(items, ["a", "b"]);
});

test("GET /assets never returns PROFILE, even when explicitly requested", async () => {
  const res = await handleGalleryAssets(service(SEED), new URLSearchParams("category=PROFILE"));
  const json = await body(res);
  assert.equal((json.data as unknown[]).length, 0);
  assert.equal((json.meta as { pagination: { total: number } }).pagination.total, 0);
});

test("GET /assets rejects an invalid pageSize with 400", async () => {
  const res = await handleGalleryAssets(service(SEED), new URLSearchParams("pageSize=9999"));
  assert.equal(res.status, 400);
  assert.equal(((await body(res)).error as { code: string }).code, "BAD_REQUEST");
});

test("GET /assets rejects an unknown category with 400", async () => {
  const res = await handleGalleryAssets(service(SEED), new URLSearchParams("category=NOT_A_CATEGORY"));
  assert.equal(res.status, 400);
});

test("GET /assets/{id} returns the asset", async () => {
  const res = await handleGalleryAssetById(service(SEED), "a");
  assert.equal(res.status, 200);
  assert.equal(((await body(res)).data as { assetId: string }).assetId, "a");
});

test("GET /assets/{id} returns 404 for a PROFILE asset (never exposed)", async () => {
  const res = await handleGalleryAssetById(service(SEED), "p");
  assert.equal(res.status, 404);
  assert.equal(((await body(res)).error as { code: string }).code, "NOT_FOUND");
});

test("GET /assets/{id} returns 404 for an unknown asset", async () => {
  const res = await handleGalleryAssetById(service(SEED), "nope");
  assert.equal(res.status, 404);
});

test("GET /categories returns Gallery category facets (PROFILE excluded)", async () => {
  const res = await handleGalleryCategories(service(SEED));
  const cats = (await body(res)).data as Array<{ category: string; count: number }>;
  assert.equal(cats.find((c) => c.category === "COMPANY_LOCATION")?.count, 3);
  assert.equal(cats.find((c) => c.category === "NEIGHBOR_MAP")?.count, 1);
  assert.equal(cats.find((c) => c.category === "PROFILE"), undefined);
});

test("GET /regions returns region facets scoped to ?category", async () => {
  const res = await handleGalleryRegions(service(SEED), new URLSearchParams("category=COMPANY_LOCATION"));
  const regions = (await body(res)).data as Array<{ value: string; count: number }>;
  assert.equal(regions.find((r) => r.value === "ภาค 1")?.count, 2);
  assert.equal(regions.find((r) => r.value === "ภาค 2")?.count, 1);
});

test("GET /companies returns company facets scoped to ?category & ?region", async () => {
  const res = await handleGalleryCompanies(service(SEED), new URLSearchParams("category=COMPANY_LOCATION&region=ภาค 1"));
  const companies = (await body(res)).data as Array<{ value: string; count: number }>;
  assert.deepEqual(companies, [{ value: "ตชด.447", count: 2 }]);
});
