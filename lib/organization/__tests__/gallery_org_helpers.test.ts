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
import { COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

test("companyCodeFromLabel extracts a recognized company number from a label", () => {
  assert.equal(companyCodeFromLabel("ร้อย ตชด.416"), "416");
  assert.equal(companyCodeFromLabel("416"), "416");
});

test("companyCodeFromLabel returns null for an unrecognized number or non-numeric text", () => {
  assert.equal(companyCodeFromLabel("ร้อย ตชด.999"), null);
  assert.equal(companyCodeFromLabel("ไม่มีตัวเลข"), null);
});

test("battalionCodeFromLabel extracts a recognized battalion number", () => {
  assert.equal(battalionCodeFromLabel("กก.ตชด.44"), "44");
});

test("battalionCodeFromLabel returns null for an unrecognized battalion", () => {
  assert.equal(battalionCodeFromLabel("กก.ตชด.99"), null);
});

test("divisionCodeFromLabel extracts a recognized Border Patrol region", () => {
  assert.equal(divisionCodeFromLabel("ภาค 4"), "4");
  assert.equal(divisionCodeFromLabel("ตชด.ภาค 4"), "4");
});

test("divisionCodeFromLabel returns null for a non-Border-Patrol region (5-7)", () => {
  assert.equal(divisionCodeFromLabel("ภาค 5"), null);
});

test("battalionLabelsForRegion narrows to the selected region's battalions", () => {
  const labels = battalionLabelsForRegion("ภาค 4");
  assert.deepEqual(
    [...labels].sort(),
    ["กก.ตชด.41", "กก.ตชด.42", "กก.ตชด.43", "กก.ตชด.44"].sort()
  );
});

test("battalionLabelsForRegion falls back to every battalion when the region text doesn't resolve", () => {
  const labels = battalionLabelsForRegion("custom text");
  assert.equal(labels.length, 16);
});

test("companyLabelsForBattalion narrows to the selected battalion's companies", () => {
  const labels = companyLabelsForBattalion("กก.ตชด.44");
  assert.deepEqual(
    [...labels].sort(),
    ["ร้อย ตชด.444", "ร้อย ตชด.445", "ร้อย ตชด.446", "ร้อย ตชด.447", "ร้อย ตชด.448", "ร้อย ตชด.449"].sort()
  );
});

test("companyLabelsForBattalion falls back to every company when the battalion text doesn't resolve", () => {
  const labels = companyLabelsForBattalion("custom text");
  assert.equal(labels.length, COMPANY_NUMBER_CODES.length);
});

test("autoFillFromCompanyLabel derives unit number + ancestor battalion/division for a recognized company", () => {
  assert.deepEqual(autoFillFromCompanyLabel("ร้อย ตชด.416"), {
    companyNumber: "416",
    battalionLabel: "กก.ตชด.41",
    divisionCode: "4",
  });
});

test("autoFillFromCompanyLabel returns null for an unrecognized company", () => {
  assert.equal(autoFillFromCompanyLabel("ร้อย ตชด.999"), null);
  assert.equal(autoFillFromCompanyLabel("custom text"), null);
});
