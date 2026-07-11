import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findBattalion,
  findDivision,
  findRegion,
  getOrganizationPath,
  isValidBattalion,
  isValidCompany,
} from "@/lib/organization/organization_helpers";

test("findBattalion returns the owning battalion for a company number", () => {
  assert.equal(findBattalion("434"), "43");
  assert.equal(findBattalion("114"), "11");
});

test("findBattalion returns null for a company number not in the master hierarchy", () => {
  assert.equal(findBattalion("999"), null);
});

test("findDivision (and its alias findRegion) return the owning division for a company number", () => {
  assert.equal(findDivision("434"), "4");
  assert.equal(findRegion("434"), "4");
  assert.equal(findDivision("114"), "1");
});

test("findDivision returns null for a company number not in the master hierarchy", () => {
  assert.equal(findDivision("999"), null);
});

test("getOrganizationPath returns the full division/battalion/company path", () => {
  assert.deepEqual(getOrganizationPath("434"), { divisionCode: "4", battalionCode: "43", companyCode: "434" });
});

test("getOrganizationPath returns null for an unknown company number", () => {
  assert.equal(getOrganizationPath("999"), null);
});

test("isValidBattalion / isValidCompany", () => {
  assert.equal(isValidBattalion("44"), true);
  assert.equal(isValidBattalion("99"), false);
  assert.equal(isValidCompany("449"), true);
  assert.equal(isValidCompany("999"), false);
});
