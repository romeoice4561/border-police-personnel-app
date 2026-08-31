/**
 * Relationship Query Service tests (Intelligence Search Center Phase 1B).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugIntelligenceRelationshipQueryService } from "@/lib/drug_intelligence/drug_intelligence_relationship_query_service";
import {
  DrugRelationshipQueryValidationError,
} from "@/lib/drug_intelligence/drug_relationship_query_types";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "REL-2569-001",
    title: "คดีทดสอบค้นหาความเชื่อมโยง",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "เชียงราย",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedFixture() {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "REL-PHONE-1",
      persons: [
        {
          newPerson: { primaryFullName: "สมชาย ความเชื่อม", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0811112222", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }],
          sims: [{ iccid: "8966000000000000001", imsi: "520000000000001", carrier: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          devices: [{ brand: "Samsung", model: "A1", serialNumber: null, imei1: "356789101234567", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [
            {
              registrationNumber: "กข9999",
              registrationProvince: "เชียงราย",
              vehicleType: null,
              brand: "Toyota",
              model: null,
              color: null,
              vin: null,
              firstSeenAt: null,
              lastSeenAt: null,
              notes: null,
            },
          ],
        },
      ],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "REL-PATH-A",
      persons: [
        {
          newPerson: { primaryFullName: "บุคคล เอ เส้นทาง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0822223333", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
        {
          newPerson: { primaryFullName: "บุคคล บี เส้นทาง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  return db;
}

test("relationship query: PHONE → CASE returns DIRECT facts", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const phones = await db.drugPhoneNumber.findMany({});
  const phone = phones.find((p: { normalizedNumber?: string }) => String(p.normalizedNumber ?? "").includes("811112222")) ?? phones[0];

  const result = await service.query(
    {
      source: { entityType: "PHONE", entityId: phone.id },
      relationId: "phone_found_in_case",
      target: { entityType: "CASE" },
    },
    { canViewFull: true, actorId: "mock:admin", actorName: "Administrator" }
  );

  assert.equal(result.interpretation.kind, "QUERY");
  assert.ok(result.summary.total >= 1);
  assert.ok(result.results.every((r) => r.edgeKind === "DIRECT"));
  assert.ok(result.results.every((r) => r.to.entityType === "CASE"));
  assert.ok(result.results.every((r) => r.relationshipType === "CASE_PHONE"));
});

test("relationship query: PERSON → PHONE returns DIRECT facts", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const persons = await db.drugPerson.findMany({});
  const person = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("สมชาย"))!;

  const result = await service.query(
    {
      source: { entityType: "PERSON", entityId: person.id },
      relationId: "person_related_phone",
      target: { entityType: "PHONE" },
    },
    { canViewFull: true }
  );

  assert.ok(result.summary.total >= 1);
  assert.ok(result.results.every((r) => r.edgeKind === "DIRECT"));
  assert.ok(result.results.every((r) => r.to.entityType === "PHONE"));
});

test("relationship query: VEHICLE / DEVICE / SIM → CASE", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const vehicles = await db.drugVehicle.findMany({});
  const devices = await db.drugDevice.findMany({});
  const sims = await db.drugSim.findMany({});

  for (const [entityType, entityId, relationId] of [
    ["VEHICLE", vehicles[0].id, "vehicle_found_in_case"],
    ["DEVICE", devices[0].id, "device_found_in_case"],
    ["SIM", sims[0].id, "sim_found_in_case"],
  ] as const) {
    const result = await service.query(
      {
        source: { entityType, entityId },
        relationId,
        target: { entityType: "CASE" },
      },
      { canViewFull: true }
    );
    assert.ok(result.summary.total >= 1, `${relationId} should find cases`);
    assert.ok(result.results.every((r) => r.edgeKind === "DIRECT"));
  }
});

test("relationship query: PERSON A → PERSON B path found", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const persons = await db.drugPerson.findMany({});
  const a = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("เอ"))!;
  const b = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("บี"))!;

  const result = await service.query(
    {
      source: { entityType: "PERSON", entityId: a.id },
      relationId: "person_path_to_person",
      target: { entityType: "PERSON", entityId: b.id },
    },
    { canViewFull: true }
  );

  assert.equal(result.summary.found, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]!.resultKind, "PATH");
  assert.equal(result.results[0]!.edgeKind, "PATH");
  assert.ok((result.results[0]!.pathSteps?.length ?? 0) >= 2);
});

test("relationship query: no path returns empty found=false without inventing absence proof", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const persons = await db.drugPerson.findMany({});
  const a = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("สมชาย"))!;
  const b = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("บี"))!;

  const result = await service.query(
    {
      source: { entityType: "PERSON", entityId: a.id },
      relationId: "person_path_to_person",
      target: { entityType: "PERSON", entityId: b.id },
    },
    { canViewFull: true }
  );

  assert.equal(result.summary.found, false);
  assert.equal(result.summary.total, 0);
  assert.equal(result.results.length, 0);
});

test("relationship query: target-specific filter narrows results", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const phones = await db.drugPhoneNumber.findMany({});
  const phone = phones[0];
  const cases = await db.drugCase.findMany({});
  const wrongCase = cases.find((c: { caseNumber: string }) => c.caseNumber === "REL-PATH-A")!;

  const result = await service.query(
    {
      source: { entityType: "PHONE", entityId: phone.id },
      relationId: "phone_found_in_case",
      target: { entityType: "CASE", entityId: wrongCase.id },
    },
    { canViewFull: true }
  );

  assert.equal(result.summary.total, 0);
});

test("relationship query: invalid relation / phone-call rejected", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const phones = await db.drugPhoneNumber.findMany({});

  await assert.rejects(
    () =>
      service.query(
        {
          source: { entityType: "PHONE", entityId: phones[0].id },
          relationId: "phone_called_phone",
          target: { entityType: "PHONE" },
        },
        { canViewFull: true }
      ),
    DrugRelationshipQueryValidationError
  );
});

test("relationship query: pagination bounds and interpretation remains QUERY", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const phones = await db.drugPhoneNumber.findMany({});

  const result = await service.query(
    {
      source: { entityType: "PHONE", entityId: phones[0].id as unknown as string },
      relationId: "phone_found_in_case",
      target: { entityType: "CASE" },
      page: 1,
      pageSize: 1,
    },
    { canViewFull: true, actorId: "mock:admin", actorName: "Administrator" }
  );

  assert.ok(result.bounds.pageSize <= 50);
  assert.equal(result.interpretation.kind, "QUERY");
  assert.ok(result.results.every((r) => r.resultKind === "EDGE"));
});

test("relationship query: audit stores types/counts not raw phone", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const phones = await db.drugPhoneNumber.findMany({});
  const phone = phones[0];

  await service.query(
    {
      source: { entityType: "PHONE", entityId: phone.id },
      relationId: "phone_found_in_case",
      target: { entityType: "CASE" },
    },
    { canViewFull: true, actorId: "mock:admin", actorName: "Administrator" }
  );

  const audits = await db.drugAuditLog.findMany({ where: { action: "relationship_search_performed" } });
  assert.equal(audits.length, 1);
  const detail = (audits[0] as { detail: string }).detail;
  assert.ok(detail.includes("sourceType=PHONE"));
  assert.ok(detail.includes("relation=phone_found_in_case"));
  assert.ok(!detail.includes("0811112222"));
  assert.ok(!detail.includes(phone.id) || detail.includes("sourceType=")); // entity id optional; phone number must not appear
  assert.ok(!/08\d{8}/.test(detail));
});

test("relationship query: masking still returns labels when canViewFull=false", async () => {
  const db = await seedFixture();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const persons = await db.drugPerson.findMany({});
  const person = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("สมชาย"))!;

  const result = await service.query(
    {
      source: { entityType: "PERSON", entityId: person.id },
      relationId: "person_related_phone",
      target: { entityType: "PHONE" },
    },
    { canViewFull: false }
  );

  assert.ok(result.summary.total >= 1);
  assert.ok(result.results[0]!.to.label.length > 0);
});
