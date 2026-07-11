import { test } from "node:test";
import assert from "node:assert/strict";

import { unitNamePrefixForCategory } from "@/lib/organization/gallery_unit_name_prefixes";
import { AssetCategory } from "@/lib/gallery/asset_category";

test("unitNamePrefixForCategory maps OrgChart to the ชปข./ชปส. prefix, concatenated", () => {
  assert.deepEqual(unitNamePrefixForCategory(AssetCategory.OrgChart), { prefix: "ชปข./ชปส.", spaced: false });
});

test("unitNamePrefixForCategory maps DeploymentMap to แผนผังวางกำลังพล, spaced", () => {
  assert.deepEqual(unitNamePrefixForCategory(AssetCategory.DeploymentMap), { prefix: "แผนผังวางกำลังพล", spaced: true });
});

test("unitNamePrefixForCategory maps NeighborMap to แผนที่หน่วยข้างเคียง, spaced", () => {
  assert.deepEqual(unitNamePrefixForCategory(AssetCategory.NeighborMap), { prefix: "แผนที่หน่วยข้างเคียง", spaced: true });
});

test("unitNamePrefixForCategory returns null for a category with no generated-name convention", () => {
  assert.equal(unitNamePrefixForCategory(AssetCategory.CompanyLocation), null);
  assert.equal(unitNamePrefixForCategory(AssetCategory.Unknown), null);
});
