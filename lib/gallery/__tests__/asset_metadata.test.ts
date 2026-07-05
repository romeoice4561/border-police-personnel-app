/**
 * Unit tests for the Gallery metadata parsers (Phase 19A). Pure — folder-name
 * derivation only, no OCR/AI/I/O.
 *
 * Run with:
 *   npx tsx --test lib/gallery/__tests__/asset_metadata.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractRegion, extractCompany, extractBattalion, parseAssetPlacement } from "@/lib/gallery/asset_metadata";

test("extractRegion reads 'ภาค N' from a semantic top-level folder", () => {
  assert.equal(extractRegion(["Profile รายบุคคล ภาค 1"]), "ภาค 1");
  assert.equal(extractRegion(["แผนที่หน่วยข้างเคียง ภาค 3"]), "ภาค 3");
  assert.equal(extractRegion(["แผนผังการวางกำลัง ภาค 4", "sub"]), "ภาค 4");
});

test("extractRegion converts Thai numerals and tolerates spacing", () => {
  assert.equal(extractRegion(["Profile ภาค ๒"]), "ภาค 2");
  assert.equal(extractRegion(["ภาค  12"]), "ภาค 12");
});

test("extractRegion returns null when no region is present", () => {
  assert.equal(extractRegion(["แผนที่ตั้งกองร้อย", "ตชด.447"]), null);
  assert.equal(extractRegion([null, undefined, ""]), null);
});

test("extractCompany reads 'ตชด.NNN' from a company subfolder", () => {
  assert.equal(extractCompany(["แผนที่ตั้งกองร้อย", "ตชด.447"]), "ตชด.447");
  assert.equal(extractCompany(["ตชด.114"]), "ตชด.114");
});

test("extractCompany does NOT read a battalion token as a company", () => {
  assert.equal(extractCompany(["แผนที่ตั้ง กองกำกับ ตชด", "กก.ตชด.44"]), null);
});

test("extractBattalion reads 'กก.ตชด.NN' from a battalion subfolder", () => {
  assert.equal(extractBattalion(["แผนที่ตั้ง กองกำกับ ตชด", "กก.ตชด.44"]), "กก.ตชด.44");
  assert.equal(extractBattalion(["กก.ตชด.11"]), "กก.ตชด.11");
});

test("extractBattalion returns null for a plain company folder", () => {
  assert.equal(extractBattalion(["แผนที่ตั้งกองร้อย", "ตชด.447"]), null);
});

test("parseAssetPlacement derives all three at once", () => {
  assert.deepEqual(parseAssetPlacement(["แผนที่ตั้งกองร้อย", "ตชด.447"]), {
    region: null,
    company: "ตชด.447",
    battalion: null,
  });
  assert.deepEqual(parseAssetPlacement(["แผนที่หน่วยข้างเคียง ภาค 2"]), {
    region: "ภาค 2",
    company: null,
    battalion: null,
  });
  assert.deepEqual(parseAssetPlacement(["แผนที่ตั้ง กองกำกับ ตชด", "กก.ตชด.44"]), {
    region: null,
    company: null,
    battalion: "กก.ตชด.44",
  });
});
