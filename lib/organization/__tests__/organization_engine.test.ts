import { test } from "node:test";
import assert from "node:assert/strict";

import { OrganizationEngine, organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";

function tree(): OrgTree {
  return {
    headquarters: [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }],
    regions: [
      { id: 10, code: "4", nameTh: "ภาค 4", headquartersId: 1 },
      { id: 20, code: "1", nameTh: "ภาค 1", headquartersId: 1 },
    ],
    battalions: [
      { id: 100, code: "43", nameTh: "กก.ตชด.43", regionId: 10 },
      { id: 101, code: "44", nameTh: "กก.ตชด.44", regionId: 10 },
      { id: 200, code: "11", nameTh: "กก.ตชด.11", regionId: 20 },
    ],
    companies: [
      { id: 1000, code: "434", nameTh: "ตชด.434", battalionId: 100 },
      { id: 1001, code: "435", nameTh: "ตชด.435", battalionId: 100 },
      { id: 1010, code: "444", nameTh: "ตชด.444", battalionId: 101 },
      { id: 2000, code: "114", nameTh: "ตชด.114", battalionId: 200 },
    ],
  };
}

function engine(): OrganizationEngine {
  return new OrganizationEngine(tree());
}

test("getRegions/getBattalions/getCompanies traverse the hierarchy, cascaded by parent id", () => {
  const e = engine();
  assert.equal(e.getRegions().length, 2);
  assert.deepEqual(e.getBattalions(10).map((b) => b.code).sort(), ["43", "44"]);
  assert.deepEqual(e.getBattalions().length, 3); // no arg = every battalion
  assert.deepEqual(e.getCompanies(100).map((c) => c.code).sort(), ["434", "435"]);
  assert.equal(e.getCompanies().length, 4); // no arg = every company
});

test("getCompany/getCompanyByCode/getBattalionByCode/getRegionByCode look up a single row", () => {
  const e = engine();
  assert.equal(e.getCompany(1000)?.code, "434");
  assert.equal(e.getCompany(99999), null);
  assert.equal(e.getCompanyByCode("444")?.id, 1010);
  assert.equal(e.getBattalionByCode("44")?.id, 101);
  assert.equal(e.getRegionByCode("4")?.id, 10);
  assert.equal(e.getCompanyByCode("999"), null);
});

test("resolveLabels resolves display labels from an org selection", () => {
  const e = engine();
  const labels = e.resolveLabels({ headquartersId: 1, regionId: 10, battalionId: 100, companyId: 1000 });
  assert.equal(labels.company, "ตชด.434");
  assert.equal(labels.battalion, "กก.ตชด.43");
});

test("cascade.fromCompany/fromBattalion/fromRegion auto-fill ancestor ids (Part 7 Auto Fill)", () => {
  const e = engine();
  assert.deepEqual(e.cascade.fromCompany(1000), { headquartersId: 1, regionId: 10, battalionId: 100, companyId: 1000 });
  assert.deepEqual(e.cascade.fromBattalion(101), { headquartersId: 1, regionId: 10, battalionId: 101, companyId: null });
  assert.deepEqual(e.cascade.fromRegion(20), { headquartersId: 1, regionId: 20, battalionId: null, companyId: null });
});

test("getRegionOptions/getBattalionOptions/getCompanyOptions return ready-to-render {value,label} pairs", () => {
  const e = engine();
  const regionOptions = e.getRegionOptions();
  assert.equal(regionOptions.length, 2);
  assert.ok(regionOptions.every((o) => typeof o.value === "string" && typeof o.label === "string"));

  const battalionOptions = e.getBattalionOptions(10);
  assert.deepEqual(battalionOptions.map((o) => o.label).sort(), ["กก.ตชด.43", "กก.ตชด.44"]);

  const companyOptions = e.getCompanyOptions(100);
  assert.deepEqual(companyOptions.map((o) => o.label).sort(), ["ตชด.434", "ตชด.435"]);
});

test("searchOrganization finds a company by code or label substring, most-specific-level-first", () => {
  const e = engine();
  const results = e.searchOrganization("434");
  assert.ok(results.some((r) => r.level === "company" && r.code === "434"));
});

test("searchOrganization finds a battalion and returns its full ancestor path", () => {
  const e = engine();
  const results = e.searchOrganization("44");
  const battalionHit = results.find((r) => r.level === "battalion" && r.code === "44");
  assert.ok(battalionHit);
  assert.deepEqual(battalionHit!.path, { headquartersId: 1, regionId: 10, battalionId: 101, companyId: null });
});

test("searchOrganization returns [] for an empty/whitespace query (never matches everything)", () => {
  const e = engine();
  assert.deepEqual(e.searchOrganization(""), []);
  assert.deepEqual(e.searchOrganization("   "), []);
});

test("searchOrganization is case-insensitive", () => {
  const e = engine();
  const results = e.searchOrganization("BPP");
  assert.ok(results.some((r) => r.level === "headquarters"));
});

test("validateOrganization: true for ids present in the tree, false with a reason otherwise", () => {
  const e = engine();
  assert.deepEqual(e.validateOrganization({ companyId: 1000 }), { valid: true });
  assert.equal(e.validateOrganization({ companyId: 99999 }).valid, false);
  assert.equal(e.validateOrganization({ battalionId: 99999 }).valid, false);
  assert.equal(e.validateOrganization({ regionId: 99999 }).valid, false);
  assert.deepEqual(e.validateOrganization({}), { valid: true }); // nothing to validate = valid
});

test("organizationEngineFromTree builds an engine over an already-known tree, defaulting to an empty tree", () => {
  const e1 = organizationEngineFromTree(tree());
  assert.equal(e1.getRegions().length, 2);

  const e2 = organizationEngineFromTree();
  assert.deepEqual(e2.getRegions(), []);
  assert.deepEqual(e2.getOrganizationTree(), { headquarters: [], regions: [], battalions: [], companies: [] });
});
