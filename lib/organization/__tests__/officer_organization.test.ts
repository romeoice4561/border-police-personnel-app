/**
 * Officer <-> Organization resolution tests (Phase 20C).
 *
 * Verifies resolveOfficerOrganization/Company/Battalion/Region against a
 * seeded OrganizationService: successful resolution (currentUnit, timeline
 * fallback), unknown/unregistered codes, and officers with no resolvable
 * organization text at all (NULL, never invented).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryOrganizationRepository } from "@/lib/organization/organization_repository";
import { OrganizationService } from "@/lib/organization/organization_service";
import { seedOrganization } from "@/lib/organization/organization_seed";
import {
  resolveOfficerOrganization,
  resolveOfficerCompany,
  resolveOfficerBattalion,
  resolveOfficerRegion,
} from "@/lib/organization/officer_organization";

async function seededService() {
  const repository = new InMemoryOrganizationRepository();
  await seedOrganization(repository);
  return new OrganizationService({ repository });
}

test("resolveOfficerOrganization resolves the full triple from currentUnit", async () => {
  const service = await seededService();
  const result = await resolveOfficerOrganization(service, { currentUnit: "ตชด.447" });
  assert.notEqual(result.companyId, null);
  assert.notEqual(result.battalionId, null);
  assert.notEqual(result.regionId, null);

  const company = await service.findCompany("447");
  assert.equal(result.companyId, company?.id);
  assert.equal(result.battalionId, company?.battalion.id);
  assert.equal(result.regionId, company?.region.id);
});

test("resolveOfficerOrganization falls back to timeline units when currentUnit is absent", async () => {
  const service = await seededService();
  const result = await resolveOfficerOrganization(service, {
    currentUnit: null,
    timeline: [{ unit: "กก.ตชด.44" }, { unit: "ตชด.447" }],
  });
  // First candidate (currentUnit absent) is the first timeline entry: กก.ตชด.44 -> battalion-level.
  assert.equal(result.companyId, null);
  const battalion = await service.findBattalion("44");
  assert.equal(result.battalionId, battalion?.id);
  assert.notEqual(result.regionId, null);
});

test("resolveOfficerOrganization returns all-null for an unregistered (unknown) code — never invents data", async () => {
  const service = await seededService();
  const result = await resolveOfficerOrganization(service, { currentUnit: "ตชด.999" });
  assert.deepEqual(result, { regionId: null, battalionId: null, companyId: null });

  const unresolved = await service.listUnresolved("officer_organization");
  assert.ok(unresolved.some((u) => u.raw === "ตชด.999"));
});

test("resolveOfficerOrganization returns all-null when there is no organization text at all", async () => {
  const service = await seededService();
  const result = await resolveOfficerOrganization(service, {});
  assert.deepEqual(result, { regionId: null, battalionId: null, companyId: null });
});

test("resolveOfficerCompany resolves only to a registered Company, else null", async () => {
  const service = await seededService();
  const resolved = await resolveOfficerCompany(service, { currentUnit: "ตชด.447" });
  assert.equal(resolved?.status, "resolved");
  if (resolved?.status === "resolved" && resolved.level === "company") {
    assert.equal(resolved.company.code, "447");
  } else {
    assert.fail("expected a resolved company");
  }

  const unresolved = await resolveOfficerCompany(service, { currentUnit: "ตชด.999" });
  assert.equal(unresolved, null);
});

test("resolveOfficerBattalion accepts a battalion-level or company-level resolution", async () => {
  const service = await seededService();
  const fromBattalionText = await resolveOfficerBattalion(service, { currentUnit: "กก.ตชด.44" });
  assert.equal(fromBattalionText?.status, "resolved");

  const fromCompanyText = await resolveOfficerBattalion(service, { currentUnit: "ตชด.447" });
  assert.equal(fromCompanyText?.status, "resolved");

  const none = await resolveOfficerBattalion(service, {});
  assert.equal(none, null);
});

test("resolveOfficerRegion falls back to the officer's own `region` text as a last resort", async () => {
  const service = await seededService();
  const result = await resolveOfficerRegion(service, { currentUnit: null, region: "ภาค 4" });
  assert.equal(result?.status, "resolved");
  if (result?.status === "resolved") {
    assert.equal(result.level, "region");
  }
});

test("resolveOfficerRegion returns null when nothing resolves", async () => {
  const service = await seededService();
  const result = await resolveOfficerRegion(service, { currentUnit: "not an organization code" });
  assert.equal(result, null);
});
