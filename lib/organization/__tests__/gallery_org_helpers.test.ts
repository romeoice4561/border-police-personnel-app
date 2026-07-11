import { test } from "node:test";
import assert from "node:assert/strict";

import {
  companyCodeFromLabel,
  battalionCodeFromLabel,
  divisionCodeFromLabel,
  battalionLabelsForRegion,
  companyLabelsForBattalion,
  autoFillFromCompanyLabel,
} from "@/lib/organization/gallery_org_helpers";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";

function tree(): OrgTree {
  return {
    headquarters: [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }],
    regions: [
      { id: 10, code: "4", nameTh: "ภาค 4", headquartersId: 1 },
      { id: 20, code: "1", nameTh: "ภาค 1", headquartersId: 1 },
    ],
    battalions: [
      { id: 100, code: "41", nameTh: "กก.ตชด.41", regionId: 10 },
      { id: 101, code: "44", nameTh: "กก.ตชด.44", regionId: 10 },
      { id: 200, code: "11", nameTh: "กก.ตชด.11", regionId: 20 },
    ],
    companies: [
      { id: 1000, code: "414", nameTh: "ร้อย ตชด.414", battalionId: 100 },
      { id: 1001, code: "416", nameTh: "ร้อย ตชด.416", battalionId: 100 },
      { id: 1010, code: "444", nameTh: "ร้อย ตชด.444", battalionId: 101 },
      { id: 1011, code: "445", nameTh: "ร้อย ตชด.445", battalionId: 101 },
      { id: 2000, code: "114", nameTh: "ร้อย ตชด.114", battalionId: 200 },
    ],
  };
}

function engine() {
  return organizationEngineFromTree(tree());
}

test("companyCodeFromLabel extracts a recognized company number from a label", () => {
  const e = engine();
  assert.equal(companyCodeFromLabel(e, "ร้อย ตชด.416"), "416");
  assert.equal(companyCodeFromLabel(e, "416"), "416");
});

test("companyCodeFromLabel returns null for an unrecognized number or non-numeric text", () => {
  const e = engine();
  assert.equal(companyCodeFromLabel(e, "ร้อย ตชด.999"), null);
  assert.equal(companyCodeFromLabel(e, "ไม่มีตัวเลข"), null);
});

test("battalionCodeFromLabel extracts a recognized battalion number", () => {
  const e = engine();
  assert.equal(battalionCodeFromLabel(e, "กก.ตชด.44"), "44");
});

test("battalionCodeFromLabel returns null for an unrecognized battalion", () => {
  const e = engine();
  assert.equal(battalionCodeFromLabel(e, "กก.ตชด.99"), null);
});

test("divisionCodeFromLabel extracts a recognized Border Patrol region", () => {
  const e = engine();
  assert.equal(divisionCodeFromLabel(e, "ภาค 4"), "4");
  assert.equal(divisionCodeFromLabel(e, "ตชด.ภาค 4"), "4");
});

test("divisionCodeFromLabel returns null for an unrecognized region", () => {
  const e = engine();
  assert.equal(divisionCodeFromLabel(e, "ภาค 9"), null);
});

test("battalionLabelsForRegion narrows to the selected region's battalions", () => {
  const e = engine();
  const labels = battalionLabelsForRegion(e, "ภาค 4");
  assert.deepEqual([...labels].sort(), ["กก.ตชด.41", "กก.ตชด.44"].sort());
});

test("battalionLabelsForRegion falls back to every battalion when the region text doesn't resolve", () => {
  const e = engine();
  const labels = battalionLabelsForRegion(e, "custom text");
  assert.equal(labels.length, 3);
});

test("companyLabelsForBattalion narrows to the selected battalion's companies", () => {
  const e = engine();
  const labels = companyLabelsForBattalion(e, "กก.ตชด.44");
  assert.deepEqual([...labels].sort(), ["ร้อย ตชด.444", "ร้อย ตชด.445"].sort());
});

test("companyLabelsForBattalion falls back to every company when the battalion text doesn't resolve", () => {
  const e = engine();
  const labels = companyLabelsForBattalion(e, "custom text");
  assert.equal(labels.length, 5);
});

test("autoFillFromCompanyLabel derives unit number + ancestor battalion/division for a recognized company", () => {
  const e = engine();
  assert.deepEqual(autoFillFromCompanyLabel(e, "ร้อย ตชด.416"), {
    companyNumber: "416",
    battalionLabel: "กก.ตชด.41",
    divisionCode: "4",
  });
});

test("autoFillFromCompanyLabel returns null for an unrecognized company", () => {
  const e = engine();
  assert.equal(autoFillFromCompanyLabel(e, "ร้อย ตชด.999"), null);
  assert.equal(autoFillFromCompanyLabel(e, "custom text"), null);
});
