import { test } from "node:test";
import assert from "node:assert/strict";

import {
  battalionsForRegion,
  companiesForBattalion,
  autoFillFromCompany,
  autoFillFromBattalion,
  autoFillFromRegion,
  EMPTY_ORG_SELECTION,
  type OrgTree,
} from "@/lib/organization/org_tree";

function tree(): OrgTree {
  return {
    headquarters: [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }],
    regions: [{ id: 10, code: "4", nameTh: "ภาค 4", headquartersId: 1 }],
    battalions: [{ id: 100, code: "43", nameTh: "กก.ตชด.43", regionId: 10 }],
    companies: [{ id: 1000, code: "434", nameTh: "ตชด.434", battalionId: 100 }],
  };
}

test("battalionsForRegion returns only battalions under that region, empty for null/unknown region", () => {
  const t = tree();
  assert.deepEqual(battalionsForRegion(t, 10).map((b) => b.code), ["43"]);
  assert.deepEqual(battalionsForRegion(t, null), []);
  assert.deepEqual(battalionsForRegion(t, 999), []);
});

test("companiesForBattalion returns only companies under that battalion, empty for null/unknown battalion", () => {
  const t = tree();
  assert.deepEqual(companiesForBattalion(t, 100).map((c) => c.code), ["434"]);
  assert.deepEqual(companiesForBattalion(t, null), []);
  assert.deepEqual(companiesForBattalion(t, 999), []);
});

test("Part D: autoFillFromCompany derives battalion/region/headquarters from a selected company (434 -> 43 -> ภาค4 -> บช.ตชด.)", () => {
  const t = tree();
  const result = autoFillFromCompany(t, 1000);
  assert.deepEqual(result, { headquartersId: 1, regionId: 10, battalionId: 100, companyId: 1000 });
});

test("autoFillFromCompany returns EMPTY_ORG_SELECTION for null or an unknown company id (never guesses)", () => {
  const t = tree();
  assert.deepEqual(autoFillFromCompany(t, null), EMPTY_ORG_SELECTION);
  assert.deepEqual(autoFillFromCompany(t, 99999), EMPTY_ORG_SELECTION);
});

test("autoFillFromBattalion derives region/headquarters and clears companyId (selecting a battalion doesn't imply a company)", () => {
  const t = tree();
  const result = autoFillFromBattalion(t, 100);
  assert.deepEqual(result, { headquartersId: 1, regionId: 10, battalionId: 100, companyId: null });
});

test("autoFillFromRegion derives headquarters and clears battalionId/companyId", () => {
  const t = tree();
  const result = autoFillFromRegion(t, 10);
  assert.deepEqual(result, { headquartersId: 1, regionId: 10, battalionId: null, companyId: null });
});

test("autoFillFromRegion returns EMPTY_ORG_SELECTION when the region has no headquarters set (still resolves what it can)", () => {
  const t = tree();
  t.regions[0].headquartersId = null;
  const result = autoFillFromRegion(t, 10);
  assert.deepEqual(result, { headquartersId: null, regionId: 10, battalionId: null, companyId: null });
});
