import { test } from "node:test";
import assert from "node:assert/strict";

import { divisionDropdown, battalionDropdown, companyDropdown, companyNumberDropdown } from "@/lib/organization/dropdown_options";
import { DIVISION_CODES, BATTALION_CODES, COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

test("divisionDropdown has one option per Border Patrol division (1-4 only, Phase 26D Part 7)", () => {
  assert.equal(divisionDropdown.length, DIVISION_CODES.length);
  assert.equal(divisionDropdown.length, 4);
  assert.equal(divisionDropdown.some((o) => o.value === "5"), false);
  assert.deepEqual(
    divisionDropdown.find((o) => o.value === "4"),
    { value: "4", label: "ภาค 4" }
  );
});

test("battalionDropdown has one option per battalion with the กก.ตชด. label", () => {
  assert.equal(battalionDropdown.length, BATTALION_CODES.length);
  assert.deepEqual(
    battalionDropdown.find((o) => o.value === "44"),
    { value: "44", label: "กก.ตชด.44" }
  );
});

test("companyDropdown / companyNumberDropdown cover every company code", () => {
  assert.equal(companyDropdown.length, COMPANY_NUMBER_CODES.length);
  assert.equal(companyNumberDropdown.length, COMPANY_NUMBER_CODES.length);
  assert.deepEqual(
    companyDropdown.find((o) => o.value === "434"),
    { value: "434", label: "ร้อย ตชด.434" }
  );
  assert.deepEqual(
    companyNumberDropdown.find((o) => o.value === "434"),
    { value: "434", label: "434" }
  );
});
