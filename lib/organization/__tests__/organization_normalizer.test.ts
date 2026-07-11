import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryOrganizationRepository } from "@/lib/organization/organization_repository";
import { OrganizationService } from "@/lib/organization/organization_service";
import { seedOrganization } from "@/lib/organization/organization_seed";
import { OrganizationNormalizer } from "@/lib/organization/organization_engine";

async function seededNormalizer() {
  const repository = new InMemoryOrganizationRepository();
  await seedOrganization(repository);
  const service = new OrganizationService({ repository });
  return { repository, normalizer: new OrganizationNormalizer({ repository, service }) };
}

test("normalizeCompany resolves a well-formed registered company code", async () => {
  const { normalizer } = await seededNormalizer();
  const result = await normalizer.normalizeCompany("ร้อย ตชด.434");
  assert.deepEqual(result, { code: "434", viaAlias: false });
});

test("normalizeBattalion resolves a well-formed registered battalion code", async () => {
  const { normalizer } = await seededNormalizer();
  const result = await normalizer.normalizeBattalion("กก.ตชด.43");
  assert.deepEqual(result, { code: "43", viaAlias: false });
});

test("normalizeRegion resolves a well-formed registered region code", async () => {
  const { normalizer } = await seededNormalizer();
  const result = await normalizer.normalizeRegion("ภาค4");
  assert.deepEqual(result, { code: "4", viaAlias: false });
});

test("normalizeCompany returns null for text that resolves at the wrong level (a battalion code, not a company)", async () => {
  const { normalizer } = await seededNormalizer();
  assert.equal(await normalizer.normalizeCompany("กก.ตชด.43"), null);
});

test("normalizeCompany returns null for unregistered/unparseable text", async () => {
  const { normalizer } = await seededNormalizer();
  assert.equal(await normalizer.normalizeCompany("not an organization code"), null);
  assert.equal(await normalizer.normalizeCompany("ร้อย ตชด.999"), null);
});

test("normalizeUnit accepts any level, returning the most specific resolvable one", async () => {
  const { normalizer } = await seededNormalizer();
  const companyLevel = await normalizer.normalizeUnit("ร้อย ตชด.434");
  assert.deepEqual(companyLevel, { level: "company", code: "434", viaAlias: false });

  const battalionLevel = await normalizer.normalizeUnit("กก.ตชด.43");
  assert.deepEqual(battalionLevel, { level: "battalion", code: "43", viaAlias: false });
});

test("registerAlias + normalizeCompany: an OCR-variant alias resolves to its canonical company code", async () => {
  const { repository, normalizer } = await seededNormalizer();
  const company = await repository.findCompanyByCode("434");
  assert.ok(company);

  await normalizer.registerAlias("Company 434 (OCR)", { companyId: company!.id }, "ocr-variant");

  const result = await normalizer.normalizeCompany("Company 434 (OCR)");
  assert.deepEqual(result, { code: "434", viaAlias: true });
});

test("registerAlias + normalizeBattalion: a legacy long-form battalion name resolves via alias", async () => {
  const { repository, normalizer } = await seededNormalizer();
  const battalion = await repository.findBattalionByCode("41");
  assert.ok(battalion);

  await normalizer.registerAlias("กองกำกับการตำรวจตระเวนชายแดนที่ 41", { battalionId: battalion!.id }, "ocr-variant");

  const result = await normalizer.normalizeBattalion("กองกำกับการตำรวจตระเวนชายแดนที่ 41");
  assert.deepEqual(result, { code: "41", viaAlias: true });
});

test("alias lookup is case-insensitive and whitespace-trimmed", async () => {
  const { repository, normalizer } = await seededNormalizer();
  const company = await repository.findCompanyByCode("434");
  await normalizer.registerAlias("Company 434", { companyId: company!.id }, "manual");

  assert.deepEqual(await normalizer.normalizeCompany("  company 434  "), { code: "434", viaAlias: true });
});

test("validateOrganizationText: true for anything that resolves at any level, false otherwise", async () => {
  const { normalizer } = await seededNormalizer();
  assert.equal(await normalizer.validateOrganizationText("ร้อย ตชด.434"), true);
  assert.equal(await normalizer.validateOrganizationText("ภาค4"), true);
  assert.equal(await normalizer.validateOrganizationText("nonsense text"), false);
});

test("normalizeUnit never invents a match — an alias pointing at a company id that no longer exists resolves to null", async () => {
  const { repository, normalizer } = await seededNormalizer();
  await normalizer.registerAlias("ghost unit", { companyId: 999999 }, "manual");
  assert.equal(await normalizer.normalizeUnit("ghost unit"), null);
  // sanity: the alias really was recorded (registerAlias itself doesn't validate the id — resolution does)
  assert.equal((await repository.listAliases()).length, 1);
});
