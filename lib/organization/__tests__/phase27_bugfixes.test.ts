/**
 * Phase 27 Bug-fix regression tests — Bugs #1-#7 (Region label format,
 * Gallery Region exact-match resolution, complete Battalion/Company data,
 * Gallery auto-fill for every official company, and official dataset
 * counts). Bug #6 (Timeline Unit Name Combobox) and Bug #2 (Gallery Region
 * Combobox contents) are exercised indirectly here at the data-source
 * level; the component-level wiring is covered by manual/live verification
 * since these are pure UI prop changes with no new logic of their own.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { DIVISION_CODES, BATTALION_CODES, COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";
import { BORDER_PATROL_DIVISION_DEFAULTS, divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";
import { organizationEngineFromTree, OrganizationEngine } from "@/lib/organization/organization_engine";
import {
  divisionCodeFromLabel,
  battalionLabelsForRegion,
  companyLabelsForBattalion,
  autoFillFromCompanyLabel,
} from "@/lib/organization/gallery_org_helpers";
import type { OrgTree } from "@/lib/organization/org_tree";

// ── Bug #1: region labels use "ตชด.ภาค N", never "ตชด.ภ.N" ──

test("Bug #1: BORDER_PATROL_DIVISION_DEFAULTS uses the full 'ตชด.ภาค N' format", () => {
  for (const d of BORDER_PATROL_DIVISION_DEFAULTS) {
    assert.match(d.label, /^ตชด\.ภาค \d$/);
    assert.doesNotMatch(d.label, /ตชด\.ภ\.\d/);
  }
});

test("Bug #1: divisionLabelForRegion produces 'ตชด.ภาค N', not the old 'ตชด.ภ.N'", () => {
  assert.equal(divisionLabelForRegion({ code: "4", nameTh: "ภาค 4" }), "ตชด.ภาค 4");
  assert.equal(divisionLabelForRegion({ code: "1", nameTh: "ภาค 1" }), "ตชด.ภาค 1");
});

// ── Bug #7: official dataset counts — 4 regions, 16 battalions, 66 companies ──

test("Bug #7: organization_master.ts (the bootstrap dataset) has exactly 4 divisions, 16 battalions, 66 companies", () => {
  assert.equal(DIVISION_CODES.length, 4);
  assert.equal(BATTALION_CODES.length, 16);
  assert.equal(COMPANY_NUMBER_CODES.length, 66);
});

test("Bug #7: battalion 44 has 6 companies (444-449), every other battalion has 4", () => {
  assert.equal(COMPANY_NUMBER_CODES.filter((c) => c.startsWith("44")).length, 6);
  for (const b of BATTALION_CODES) {
    if (b === "44") continue;
    assert.equal(COMPANY_NUMBER_CODES.filter((c) => c.startsWith(b)).length, 4, `battalion ${b} should have 4 companies`);
  }
});

test("Bug #4/#7: companies 448 and 449 are present in the official dataset", () => {
  assert.ok(COMPANY_NUMBER_CODES.includes("448"));
  assert.ok(COMPANY_NUMBER_CODES.includes("449"));
});

test("Bug #4/#7: the 8 non-official legacy codes are NOT part of the official dataset", () => {
  for (const code of ["123", "143", "223", "241", "255", "311", "313", "331"]) {
    assert.equal(COMPANY_NUMBER_CODES.includes(code), false, `${code} should not be an official company code`);
  }
});

// ── Fixture engine matching the official 4/16/66 shape, for Bug #3/#4/#5 tests ──

function officialTree(): OrgTree {
  const headquarters = [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }];
  const regions = DIVISION_CODES.map((code, i) => ({ id: 10 + i, code, nameTh: `ภาค ${code}`, headquartersId: 1 }));
  const regionIdByCode = new Map(regions.map((r) => [r.code, r.id]));

  let nextBattalionId = 100;
  const battalions: OrgTree["battalions"] = [];
  const battalionIdByCode = new Map<string, number>();
  for (const region of regions) {
    for (const bCode of BATTALION_CODES.filter((b) => b.startsWith(region.code))) {
      const id = nextBattalionId++;
      battalions.push({ id, code: bCode, nameTh: `กก.ตชด.${bCode}`, regionId: regionIdByCode.get(region.code)! });
      battalionIdByCode.set(bCode, id);
    }
  }

  let nextCompanyId = 1000;
  const companies: OrgTree["companies"] = [];
  for (const cCode of COMPANY_NUMBER_CODES) {
    const bCode = cCode.slice(0, 2);
    companies.push({ id: nextCompanyId++, code: cCode, nameTh: `ร้อย ตชด.${cCode}`, battalionId: battalionIdByCode.get(bCode)! });
  }

  return { headquarters, regions, battalions, companies };
}

function officialEngine(): OrganizationEngine {
  return organizationEngineFromTree(officialTree());
}

test("Bug #3/#4/#7: OrganizationEngine exposes all 16 battalions and 66 companies from a fully-seeded tree", () => {
  const engine = officialEngine();
  assert.equal(engine.getBattalions().length, 16);
  assert.equal(engine.getCompanies().length, 66);
});

test("Bug #3/#4/#7: every region's battalions are exposed via getBattalions(regionId) — not just region 1's", () => {
  const engine = officialEngine();
  for (const region of engine.getRegions()) {
    const battalions = engine.getBattalions(region.id).map((b) => b.code);
    assert.equal(battalions.length, 4, `region ${region.code} should have 4 battalions`);
    assert.ok(battalions.every((b) => b.startsWith(region.code)));
  }
});

// ── Bug #3: Gallery's divisionCodeFromLabel never guesses from "first digit anywhere" ──

test("Bug #3: divisionCodeFromLabel resolves an exact canonical label/code, case for case", () => {
  const engine = officialEngine();
  assert.equal(divisionCodeFromLabel(engine, "ภาค 4"), "4");
  assert.equal(divisionCodeFromLabel(engine, "4"), "4");
  assert.equal(divisionCodeFromLabel(engine, "ตชด.ภาค 4"), "4");
});

test("Bug #3: divisionCodeFromLabel returns null (never guesses) for arbitrary/unresolved text, even if it starts with a matching digit", () => {
  const engine = officialEngine();
  // Previously: regex /(\d)/ would grab "1" here and silently resolve to Region 1.
  assert.equal(divisionCodeFromLabel(engine, "1 บางอย่างที่ไม่เกี่ยวข้อง"), null);
  assert.equal(divisionCodeFromLabel(engine, "custom legacy text"), null);
  assert.equal(divisionCodeFromLabel(engine, ""), null);
});

test("Bug #3: battalionLabelsForRegion falls back to EVERY battalion (safe default), never a wrong region's battalions, when the region text doesn't exactly resolve", () => {
  const engine = officialEngine();
  const labels = battalionLabelsForRegion(engine, "1 บางอย่างที่ไม่เกี่ยวข้อง");
  assert.equal(labels.length, 16);
});

test("Bug #3: battalionLabelsForRegion narrows correctly for every region, not just region 1", () => {
  const engine = officialEngine();
  for (const code of DIVISION_CODES) {
    const labels = battalionLabelsForRegion(engine, `ภาค ${code}`);
    assert.equal(labels.length, 4, `region ${code} should narrow to 4 battalions`);
    assert.ok(labels.every((l) => l.startsWith(`กก.ตชด.${code}`)));
  }
});

// ── Bug #5: Gallery auto-fill works for every official company, not just some ──

test("Bug #5: autoFillFromCompanyLabel resolves for every one of the 66 official companies, including 444-449", () => {
  const engine = officialEngine();
  for (const code of COMPANY_NUMBER_CODES) {
    const result = autoFillFromCompanyLabel(engine, `ร้อย ตชด.${code}`);
    assert.ok(result, `company ${code} should auto-fill`);
    assert.equal(result!.companyNumber, code);
  }
});

test("Bug #5: autoFillFromCompanyLabel specifically resolves 444, 448, and 449 (the companies previously affected by the missing-data bug)", () => {
  const engine = officialEngine();
  for (const code of ["444", "445", "446", "447", "448", "449"]) {
    const result = autoFillFromCompanyLabel(engine, `ร้อย ตชด.${code}`);
    assert.deepEqual(result, { companyNumber: code, battalionLabel: "กก.ตชด.44", divisionCode: "4" });
  }
});

test("Bug #5: companyLabelsForBattalion narrows to battalion 44's 6 companies (not 4)", () => {
  const engine = officialEngine();
  const labels = companyLabelsForBattalion(engine, "กก.ตชด.44");
  assert.equal(labels.length, 6);
  assert.deepEqual(
    [...labels].sort(),
    ["ร้อย ตชด.444", "ร้อย ตชด.445", "ร้อย ตชด.446", "ร้อย ตชด.447", "ร้อย ตชด.448", "ร้อย ตชด.449"].sort()
  );
});

// ── Full cascade: Region -> Battalion -> Company ──

test("Full cascade: selecting a region narrows battalions, selecting a battalion narrows companies, end to end", () => {
  const engine = officialEngine();
  const region4 = engine.getRegionByCode("4")!;
  const battalionsInRegion4 = engine.getBattalions(region4.id);
  assert.equal(battalionsInRegion4.length, 4);

  const battalion44 = battalionsInRegion4.find((b) => b.code === "44")!;
  const companiesInBattalion44 = engine.getCompanies(battalion44.id);
  assert.equal(companiesInBattalion44.length, 6);
  assert.deepEqual(companiesInBattalion44.map((c) => c.code).sort(), ["444", "445", "446", "447", "448", "449"]);
});
