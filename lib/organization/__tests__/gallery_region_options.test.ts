import { test } from "node:test";
import assert from "node:assert/strict";

import { galleryRegionOptions } from "@/lib/organization/gallery_region_options";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";

function engine() {
  const tree: OrgTree = {
    headquarters: [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }],
    regions: [
      { id: 10, code: "1", nameTh: "ภาค 1", headquartersId: 1 },
      { id: 20, code: "2", nameTh: "ภาค 2", headquartersId: 1 },
      { id: 30, code: "3", nameTh: "ภาค 3", headquartersId: 1 },
      { id: 40, code: "4", nameTh: "ภาค 4", headquartersId: 1 },
    ],
    battalions: [],
    companies: [],
  };
  return organizationEngineFromTree(tree);
}

test("galleryRegionOptions includes every Border Patrol region from the shared engine", () => {
  const e = engine();
  for (const o of e.getRegionOptions()) {
    assert.ok(galleryRegionOptions(e).some((g) => g.value === o.value && g.label === o.label));
  }
});

test("galleryRegionOptions additionally offers the non-Border-Patrol regions 5-7, kept OUT of the engine's own data", () => {
  const e = engine();
  assert.deepEqual(
    galleryRegionOptions(e).find((o) => o.value === "5"),
    { value: "5", label: "ภาค 5" }
  );
  assert.deepEqual(
    galleryRegionOptions(e).find((o) => o.value === "7"),
    { value: "7", label: "ภาค 7" }
  );
});

test("galleryRegionOptions has exactly 7 regions (4 Border Patrol + 3 legacy)", () => {
  const e = engine();
  assert.equal(galleryRegionOptions(e).length, 7);
});
