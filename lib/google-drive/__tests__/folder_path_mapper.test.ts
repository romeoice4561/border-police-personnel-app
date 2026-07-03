import { test } from "node:test";
import assert from "node:assert/strict";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import type { DriveFolder } from "@/lib/google-drive/drive_types";

const root: DriveFolder = { id: "ROOT", name: "root", parents: [] };
const region: DriveFolder = { id: "REGION1", name: "ภาค1", parents: ["ROOT"] };
const province: DriveFolder = { id: "PROVINCE1", name: "บก.1", parents: ["REGION1"] };
const battalion: DriveFolder = { id: "BATTALION1", name: "กก.1", parents: ["PROVINCE1"] };
const company: DriveFolder = { id: "COMPANY1", name: "ร้อย.1", parents: ["BATTALION1"] };

test("maps the folder immediately under root to region", () => {
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "ROOT" });
  const unit = mapper.mapFolderChain([root, region]);

  assert.equal(unit?.region, "ภาค1");
  assert.equal(unit?.province, undefined);
});

test("maps four levels deep to region/province/battalion/company", () => {
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "ROOT" });
  const unit = mapper.mapFolderChain([root, region, province, battalion, company]);

  assert.deepEqual(unit, {
    region: "ภาค1",
    province: "บก.1",
    battalion: "กก.1",
    company: "ร้อย.1",
  });
});

test("returns undefined when the chain does not contain the configured root", () => {
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "SOME_OTHER_ROOT" });
  const unit = mapper.mapFolderChain([root, region]);

  assert.equal(unit, undefined);
});

test("returns undefined for the root folder itself (nothing below root yet)", () => {
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "ROOT" });
  const unit = mapper.mapFolderChain([root]);

  assert.equal(unit, undefined);
});

test("mapFolder returns a previously resolved unit by the leaf folder id", () => {
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "ROOT" });
  mapper.mapFolderChain([root, region, province]);

  const unit = mapper.mapFolder("PROVINCE1");
  assert.deepEqual(unit, { region: "ภาค1", province: "บก.1" });
});

test("mapFolder returns undefined for an id never resolved via mapFolderChain", () => {
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "ROOT" });
  assert.equal(mapper.mapFolder("NEVER_SEEN"), undefined);
});

test("folders deeper than four levels beyond company are ignored, not guessed", () => {
  const extraDeep: DriveFolder = { id: "EXTRA", name: "extra", parents: ["COMPANY1"] };
  const mapper = new DepthBasedFolderMapper({ rootFolderId: "ROOT" });
  const unit = mapper.mapFolderChain([root, region, province, battalion, company, extraDeep]);

  assert.deepEqual(unit, {
    region: "ภาค1",
    province: "บก.1",
    battalion: "กก.1",
    company: "ร้อย.1",
  });
});
