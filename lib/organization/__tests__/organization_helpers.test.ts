import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCompanyCode,
  normalizeBattalionCode,
  normalizeRegionCode,
  battalionCodeOfCompany,
  regionCodeOfBattalion,
  isCompanyConsistentWithBattalion,
  isBattalionConsistentWithRegion,
  parseOrganizationCode,
} from "@/lib/organization/organization_helpers";

test("normalizeCompanyCode accepts 3 digits, rejects malformed", () => {
  assert.equal(normalizeCompanyCode("447"), "447");
  assert.equal(normalizeCompanyCode("๔๔๗"), "447");
  assert.equal(normalizeCompanyCode("44"), null);
  assert.equal(normalizeCompanyCode("4470"), null);
  assert.equal(normalizeCompanyCode("04A"), null);
});

test("normalizeBattalionCode accepts 2 digits only", () => {
  assert.equal(normalizeBattalionCode("44"), "44");
  assert.equal(normalizeBattalionCode("4"), null);
  assert.equal(normalizeBattalionCode("444"), null);
});

test("normalizeRegionCode accepts 1-2 digits only", () => {
  assert.equal(normalizeRegionCode("4"), "4");
  assert.equal(normalizeRegionCode("12"), "12");
  assert.equal(normalizeRegionCode("123"), null);
  assert.equal(normalizeRegionCode("A"), null);
});

test("battalionCodeOfCompany / regionCodeOfBattalion derive the parent code", () => {
  assert.equal(battalionCodeOfCompany("447"), "44");
  assert.equal(regionCodeOfBattalion("44"), "4");
});

test("consistency checks catch mismatched hierarchy", () => {
  assert.equal(isCompanyConsistentWithBattalion("447", "44"), true);
  assert.equal(isCompanyConsistentWithBattalion("447", "41"), false);
  assert.equal(isBattalionConsistentWithRegion("44", "4"), true);
  assert.equal(isBattalionConsistentWithRegion("44", "1"), false);
});

test("parseOrganizationCode resolves a company code with implied ancestry", () => {
  const result = parseOrganizationCode("แผนที่ตั้งกองร้อย/ตชด.447");
  assert.deepEqual(result, { status: "resolved", level: "company", companyCode: "447", battalionCode: "44", regionCode: "4" });
});

test("parseOrganizationCode resolves a battalion code, not a company", () => {
  const result = parseOrganizationCode("กก.ตชด.44");
  assert.deepEqual(result, { status: "resolved", level: "battalion", battalionCode: "44", regionCode: "4" });
});

test("parseOrganizationCode resolves a bare region code", () => {
  const result = parseOrganizationCode("ภาค 4");
  assert.deepEqual(result, { status: "resolved", level: "region", regionCode: "4" });
});

test("parseOrganizationCode reports unresolved for unrecognizable text", () => {
  const result = parseOrganizationCode("some random folder name");
  assert.equal(result.status, "unresolved");
});

test("parseOrganizationCode reports unresolved for a malformed company code", () => {
  const result = parseOrganizationCode("ตชด.4470");
  assert.equal(result.status, "unresolved");
});
