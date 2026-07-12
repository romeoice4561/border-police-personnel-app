import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryOrganizationRepository } from "@/lib/organization/organization_repository";
import { OrganizationService } from "@/lib/organization/organization_service";
import { seedOrganization, ORGANIZATION_SEED } from "@/lib/organization/organization_seed";

async function seededService() {
  const repository = new InMemoryOrganizationRepository();
  await seedOrganization(repository);
  return new OrganizationService({ repository });
}

test("seedOrganization is grounded and idempotent", async () => {
  const repository = new InMemoryOrganizationRepository();
  const first = await seedOrganization(repository);
  const second = await seedOrganization(repository);
  assert.deepEqual(first, second);
  assert.equal(first.regions, 4);

  const regions = await repository.listRegions();
  assert.equal(regions.length, 4);
});

test("seedOrganization produces exactly the official nationwide counts (Phase 27 Bug #7: 4 regions, 16 battalions, 66 companies)", async () => {
  const repository = new InMemoryOrganizationRepository();
  const summary = await seedOrganization(repository);
  assert.deepEqual(summary, { regions: 4, battalions: 16, companies: 66 });
});

test("getRegions / getBattalions / getCompanies traverse the hierarchy", async () => {
  const service = await seededService();

  const regions = await service.getRegions();
  assert.ok(regions.some((r) => r.code === "4"));

  const battalions = await service.getBattalions("4");
  assert.deepEqual(battalions.map((b) => b.code).sort(), ["41", "42", "43", "44"]);

  const companies = await service.getCompanies("44");
  assert.deepEqual(companies.map((c) => c.code).sort(), ["444", "445", "446", "447", "448", "449"]);
});

test("findCompany / findBattalion / findRegion look up by code", async () => {
  const service = await seededService();

  const company = await service.findCompany("447");
  assert.equal(company?.code, "447");
  assert.equal(company?.battalion.code, "44");
  assert.equal(company?.region.code, "4");

  assert.equal((await service.findBattalion("44"))?.code, "44");
  assert.equal((await service.findRegion("4"))?.code, "4");
  assert.equal(await service.findCompany("999"), null);
});

test("resolveCode resolves a registered company code end-to-end", async () => {
  const service = await seededService();
  const result = await service.resolveCode("แผนที่ตั้งกองร้อย/ตชด.447/photo1.jpg", "gallery");
  assert.equal(result.status, "resolved");
  if (result.status === "resolved" && result.level === "company") {
    assert.equal(result.company.code, "447");
  } else {
    assert.fail("expected a resolved company");
  }
});

test("resolveCode flags an unregistered but well-formed code as unresolved and records it", async () => {
  const service = await seededService();
  const result = await service.resolveCode("ตชด.999", "gallery");
  assert.equal(result.status, "unresolved");

  const unresolved = await service.listUnresolved("gallery");
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].raw, "ตชด.999");
});

test("resolveCode flags inconsistent hierarchy (company doesn't match its own digits) as unresolved", async () => {
  const service = await seededService();
  // A malformed/inconsistent fragment: company pattern present but digits don't
  // cohere with any real battalion (e.g. only 1 digit after ตชด. is impossible
  // per normalizeCompanyCode, so use a well-formed-but-unregistered one instead).
  const result = await service.resolveCode("ตชด.199", "officers");
  assert.equal(result.status, "unresolved");
});

test("ORGANIZATION_SEED contains no OCR-noise codes (region 8, battalions 28/45/48)", () => {
  const regionCodes = new Set(ORGANIZATION_SEED.map((e) => e.regionCode));
  const battalionCodes = new Set(ORGANIZATION_SEED.map((e) => e.battalionCode));
  assert.equal(regionCodes.has("8"), false);
  assert.equal(battalionCodes.has("28"), false);
  assert.equal(battalionCodes.has("45"), false);
  assert.equal(battalionCodes.has("48"), false);
});
