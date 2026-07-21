/**
 * Phase 49A.3A — Gallery numeric search + verified predicate tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  assetMatchesSearch,
  explainGallerySearchMatch,
  isGalleryAssetVerified,
  isNumericOrgCodeQuery,
  textHasStandaloneNumericToken,
} from "@/lib/gallery/asset_search";
import { InMemoryAssetRepository } from "@/lib/gallery/asset_repository";
import { AssetCategory } from "@/lib/gallery/asset_category";
import type { Asset } from "@/lib/gallery/asset_types";

function asset(partial: Partial<Asset> & { assetId: string }): Asset {
  return {
    category: AssetCategory.NeighborMap,
    region: null,
    company: null,
    battalion: null,
    folderName: null,
    relativePath: `${partial.assetId}.jpg`,
    driveFileId: partial.assetId,
    thumbnailUrl: null,
    webViewUrl: null,
    createdTime: null,
    updatedTime: null,
    keywords: [],
    verified: false,
    ...partial,
  };
}

test("isNumericOrgCodeQuery: digits-only only", () => {
  assert.equal(isNumericOrgCodeQuery("414"), true);
  assert.equal(isNumericOrgCodeQuery(" 414 "), true);
  assert.equal(isNumericOrgCodeQuery("ตชด.414"), false);
  assert.equal(isNumericOrgCodeQuery(""), false);
});

test("standalone token: 414 matches exact / org-label / path segment; rejects 41 / 4140 / 1414", () => {
  assert.equal(textHasStandaloneNumericToken("414", "414"), true);
  assert.equal(textHasStandaloneNumericToken("ร้อย ตชด.414", "414"), true);
  assert.equal(textHasStandaloneNumericToken("กองร้อย 414", "414"), true);
  assert.equal(textHasStandaloneNumericToken("maps/_414_/a.jpg", "414"), true);
  assert.equal(textHasStandaloneNumericToken("folder/414/file.jpg", "414"), true);
  assert.equal(textHasStandaloneNumericToken("41", "414"), false);
  assert.equal(textHasStandaloneNumericToken("4140", "414"), false);
  assert.equal(textHasStandaloneNumericToken("1414", "414"), false);
});

test("414 matches exact company 414 / ตชด.414", () => {
  assert.equal(assetMatchesSearch({ company: "414" }, "414"), true);
  assert.equal(assetMatchesSearch({ company: "ตชด.414" }, "414"), true);
  assert.equal(assetMatchesSearch({ company: "ร้อย ตชด.414" }, "414"), true);
  assert.equal(explainGallerySearchMatch({ company: "ตชด.414" }, "414")?.field, "company");
});

test("414 matches visible title/folder token containing standalone 414", () => {
  assert.equal(assetMatchesSearch({ folderName: "แผนที่หน่วยข้างเคียง 414" }, "414"), true);
  assert.equal(assetMatchesSearch({ unitNumber: "414" }, "414"), true);
});

test("414 does not match 41 / 4140 / 1414 in org fields", () => {
  assert.equal(assetMatchesSearch({ company: "ตชด.41" }, "414"), false);
  assert.equal(assetMatchesSearch({ company: "ตชด.4140" }, "414"), false);
  assert.equal(assetMatchesSearch({ company: "ตชด.1414" }, "414"), false);
  assert.equal(assetMatchesSearch({ unitNumber: "4140" }, "414"), false);
});

test("414 does not match unrelated hidden/editorial keywords on a ภาค 1 asset", () => {
  const fields = {
    region: "ตชด.ภาค 1",
    company: "ตชด.115",
    battalion: "กก.ตชด.11",
    folderName: "แผนที่หน่วยข้างเคียง ภาค 1",
    relativePath: "แผนที่หน่วยข้างเคียง ภาค 1/104.jpg",
    keywords: "ตชด.115,414,แผนที่หน่วยข้างเคียง115",
  };
  assert.equal(assetMatchesSearch(fields, "414"), false);
  assert.equal(explainGallerySearchMatch(fields, "414"), null);
});

test("unrelated ภาค 1 asset excluded unless an approved org/path field has standalone 414", () => {
  assert.equal(
    assetMatchesSearch(
      { region: "ตชด.ภาค 1", company: "ตชด.115", relativePath: "a/104.jpg", keywords: "414" },
      "414"
    ),
    false
  );
  assert.equal(
    assetMatchesSearch(
      { region: "ตชด.ภาค 1", company: "ตชด.115", relativePath: "maps/414/a.jpg" },
      "414"
    ),
    true
  );
});

test("non-numeric text search still uses keywords / description", () => {
  assert.equal(assetMatchesSearch({ keywords: "แผนที่หน่วยข้างเคียง115" }, "แผนที่"), true);
  assert.equal(assetMatchesSearch({ description: "ขอบเขตด้านเหนือ" }, "ขอบเขต"), true);
});

test("isGalleryAssetVerified: only explicit true is verified", () => {
  assert.equal(isGalleryAssetVerified({ verified: true }), true);
  assert.equal(isGalleryAssetVerified({ verified: false }), false);
  assert.equal(isGalleryAssetVerified({ verified: null }), false);
  assert.equal(isGalleryAssetVerified({}), false);
});

test("in-memory repo: search before pagination + filtered total; verified filter uses helper", async () => {
  const repo = new InMemoryAssetRepository([
    asset({
      assetId: "legit-414",
      company: "ตชด.414",
      region: "ตชด.ภาค 4",
      verified: true,
      relativePath: "a/414.jpg",
    }),
    asset({
      assetId: "fake-kw-414",
      company: "ตชด.115",
      region: "ตชด.ภาค 1",
      keywords: ["414"],
      verified: false,
      relativePath: "b/115.jpg",
    }),
    asset({
      assetId: "other-verified",
      company: "ตชด.416",
      region: "ตชด.ภาค 4",
      verified: true,
      relativePath: "c/416.jpg",
    }),
    asset({
      assetId: "noise-4140",
      company: "ตชด.4140",
      region: "ตชด.ภาค 4",
      verified: true,
      relativePath: "d/4140.jpg",
    }),
  ]);

  const searchOnly = await repo.list({ search: "414", page: 1, pageSize: 1 });
  assert.equal(searchOnly.total, 1, "filtered total must ignore keyword-only false hits");
  assert.deepEqual(searchOnly.data.map((a) => a.assetId), ["legit-414"]);
  assert.equal(searchOnly.totalPages, 1);

  const verifiedOnly = await repo.list({ verified: true, pageSize: 50 });
  assert.equal(verifiedOnly.total, 3);
  assert.ok(verifiedOnly.data.every((a) => isGalleryAssetVerified(a)));

  const both = await repo.list({ search: "414", verified: true, pageSize: 50 });
  assert.equal(both.total, 1);
  assert.deepEqual(both.data.map((a) => a.assetId), ["legit-414"]);

  const clearedSearchKeepsVerified = await repo.list({ verified: true, pageSize: 50 });
  assert.equal(clearedSearchKeepsVerified.total, 3);
});

test("badge and filter share isGalleryAssetVerified (source inspection)", () => {
  const card = readFileSync(path.join(process.cwd(), "components/gallery/gallery_asset_card.tsx"), "utf8");
  const hooks = readFileSync(path.join(process.cwd(), "lib/gallery/gallery_hooks.ts"), "utf8");
  assert.match(card, /isGalleryAssetVerified/);
  assert.match(hooks, /query\.verified === true/);
  assert.doesNotMatch(card, /asset\.verified\s*\?/);
});
