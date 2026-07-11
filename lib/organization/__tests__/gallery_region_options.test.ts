import { test } from "node:test";
import assert from "node:assert/strict";

import { galleryRegionDropdown } from "@/lib/organization/gallery_region_options";
import { divisionDropdown } from "@/lib/organization/dropdown_options";

test("galleryRegionDropdown includes every Border Patrol region from the shared framework", () => {
  for (const o of divisionDropdown) {
    assert.ok(galleryRegionDropdown.some((g) => g.value === o.value && g.label === o.label));
  }
});

test("galleryRegionDropdown additionally offers the non-Border-Patrol regions 5-7, kept OUT of organization_master.ts", () => {
  assert.deepEqual(
    galleryRegionDropdown.find((o) => o.value === "5"),
    { value: "5", label: "ภาค 5" }
  );
  assert.deepEqual(
    galleryRegionDropdown.find((o) => o.value === "7"),
    { value: "7", label: "ภาค 7" }
  );
});

test("galleryRegionDropdown has exactly 7 regions (4 Border Patrol + 3 legacy)", () => {
  assert.equal(galleryRegionDropdown.length, 7);
});
