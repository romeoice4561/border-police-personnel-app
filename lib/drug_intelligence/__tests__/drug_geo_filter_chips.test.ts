/**
 * DI-8.2 — removable filter chip derivation tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveDrugGeoFilterChips } from "@/lib/drug_intelligence/drug_geo_filter_chips";
import { createEmptyDrugGeoFilterState, type DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";

function testTree(): OrgTree {
  return {
    headquarters: [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }],
    regions: [{ id: 10, code: "4", nameTh: "ภาค 4", headquartersId: 1 }],
    battalions: [{ id: 100, code: "41", nameTh: "กก.ตชด.41", regionId: 10 }],
    companies: [{ id: 1000, code: "414", nameTh: "ร้อย ตชด.414", battalionId: 100 }],
  };
}

function state(overrides: Partial<DrugGeoFilterState>): DrugGeoFilterState {
  return { ...createEmptyDrugGeoFilterState(), ...overrides };
}

test("empty filter state produces no chips", () => {
  assert.deepEqual(deriveDrugGeoFilterChips(createEmptyDrugGeoFilterState()), []);
});

test("province filter produces a removable chip with a clear patch", () => {
  const chips = deriveDrugGeoFilterChips(state({ province: "ชุมพร" }));
  assert.equal(chips.length, 1);
  assert.equal(chips[0].label, "จังหวัด: ชุมพร");
  assert.deepEqual(chips[0].clearPatch, { province: "" });
});

test("date range produces one combined chip, not two", () => {
  const chips = deriveDrugGeoFilterChips(state({ dateFrom: "2026-01-01", dateTo: "2026-01-31" }));
  assert.equal(chips.length, 1);
  assert.equal(chips[0].key, "date");
});

test("drug category chip shows the Thai label, never the raw enum", () => {
  const chips = deriveDrugGeoFilterChips(state({ drugCategory: "METHAMPHETAMINE_TABLET" }));
  assert.equal(chips[0].label, "ประเภทยา: ยาบ้า");
  assert.doesNotMatch(chips[0].label, /METHAMPHETAMINE_TABLET/);
});

test("case status chip shows the Thai label, never the raw enum", () => {
  const chips = deriveDrugGeoFilterChips(state({ status: "OPEN" }));
  assert.doesNotMatch(chips[0].label, /^สถานะคดี: OPEN$/);
});

test("personId/caseId deep-link context never produces a chip", () => {
  const chips = deriveDrugGeoFilterChips(state({ personId: "abc-123", caseId: "def-456" }));
  assert.deepEqual(chips, []);
});

test("org chip resolves the human-readable name via the organization engine when *Text is blank", () => {
  const engine = organizationEngineFromTree(testTree());
  const chips = deriveDrugGeoFilterChips(state({ companyId: 1000, companyText: "" }), engine);
  const orgChip = chips.find((c) => c.key === "reportingOrg");
  assert.ok(orgChip);
  assert.match(orgChip!.label, /ร้อย ตชด\.414/);
  assert.doesNotMatch(orgChip!.label, /#1000|1000/);
});

test("org chip shows the MOST SPECIFIC populated level only (company, not battalion, when both are set)", () => {
  const chips = deriveDrugGeoFilterChips(state({ battalionId: 100, battalionText: "กก.ตชด.41", companyId: 1000, companyText: "ร้อย ตชด.414" }));
  const orgChip = chips.find((c) => c.key === "reportingOrg");
  assert.match(orgChip!.label, /ร้อย ตชด\.414/);
});

test("org chip is omitted (never blank, never a raw id) when text is unresolved and no engine is provided", () => {
  const chips = deriveDrugGeoFilterChips(state({ companyId: 1000, companyText: "" }));
  assert.equal(chips.find((c) => c.key === "reportingOrg"), undefined);
});

test("reporting-unit and lead-unit org chips are independent", () => {
  const chips = deriveDrugGeoFilterChips(state({ companyId: 1000, companyText: "ร้อย ตชด.414", leadCompanyId: 2000, leadCompanyText: "ร้อย ตชด.415" }));
  assert.equal(chips.filter((c) => c.key === "reportingOrg" || c.key === "leadOrg").length, 2);
});

test("clearing a company chip's patch also clears its battalion/region/headquarters ancestors (dependent-clear)", () => {
  const chips = deriveDrugGeoFilterChips(state({ headquartersId: 1, regionId: 10, battalionId: 100, companyId: 1000, companyText: "ร้อย ตชด.414" }));
  const orgChip = chips.find((c) => c.key === "reportingOrg")!;
  assert.equal(orgChip.clearPatch.companyId, null);
  assert.equal(orgChip.clearPatch.battalionId, null);
  assert.equal(orgChip.clearPatch.regionId, null);
  assert.equal(orgChip.clearPatch.headquartersId, null);
});

test("multiple active filters produce multiple independent chips", () => {
  const chips = deriveDrugGeoFilterChips(state({ province: "ชุมพร", status: "OPEN", drugCategory: "HEROIN" }));
  assert.equal(chips.length, 3);
});
