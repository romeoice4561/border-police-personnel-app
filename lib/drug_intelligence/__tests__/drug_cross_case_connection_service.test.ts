/**
 * DI-8.2A — cross-case connection service integration (shared-entity fan-out).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCrossCaseConnectionService } from "@/lib/drug_intelligence/drug_cross_case_connection_service";
import { presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "X",
    title: "t",
    status: "OPEN",
    arrestDate: new Date("2026-08-05"),
    arrestTime: "18:20",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "unit",
    province: "ระนอง",
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
    actorName: "Admin",
    ...overrides,
  };
}

test("shared phone + person produce one DIRECT connected case with matched values", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });

  const case1 = await caseService.createCase(
    baseCase({
      caseNumber: "DI-TEST-001",
      arrestDate: new Date("2026-08-01"),
      arrestTime: "21:30",
      province: "สุราษฎร์ธานี",
      persons: [
        {
          newPerson: {
            primaryFullName: "นายกิตติศักดิ์ ทดสอบระบบ",
            nationality: null,
            dateOfBirth: null,
            notes: null,
            identifiers: [],
          },
          role: "ASSOCIATED_PERSON",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0900001001", firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    }),
  );

  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: case1.caseId } }))[0] as { personId: string }).personId;

  const case2 = await caseService.createCase(
    baseCase({
      caseNumber: "DI-TEST-002",
      arrestDate: new Date("2026-08-05"),
      persons: [
        {
          existingPersonId: personId,
          role: "ASSOCIATED_PERSON",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0900001001", firstSeenAt: new Date("2026-08-05"), lastSeenAt: new Date("2026-08-05"), notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    }),
  );

  const service = new DrugCrossCaseConnectionService(db);
  const result = await service.loadForCase(case2.caseId, { canViewFull: true });

  assert.equal(result.sourceCase.caseNumber, "DI-TEST-002");
  assert.equal(result.connections.length, 1);
  const conn = result.connections[0]!;
  assert.equal(conn.targetCase.caseNumber, "DI-TEST-001");
  assert.equal(conn.chronology, "BEFORE");
  assert.equal(conn.directness, "DIRECT");
  assert.ok(conn.evidenceItems.some((e) => e.entityType === "PERSON" && e.displayValue.includes("กิตติศักดิ์")));
  const phoneEv = conn.evidenceItems.find((e) => e.entityType === "PHONE");
  assert.ok(phoneEv, "expected shared phone evidence");
  assert.match(phoneEv!.displayValue, /090-000-1001|900001001|0900001001|66900001001/);
});

test("MASKING: restricted actor sees masked phone evidence", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const case1 = await caseService.createCase(
    baseCase({
      caseNumber: "MASK-A",
      arrestDate: new Date("2026-08-01"),
      persons: [
        {
          newPerson: { primaryFullName: "Mask Person", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0900001999", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    }),
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: case1.caseId } }))[0] as { personId: string }).personId;
  const case2 = await caseService.createCase(
    baseCase({
      caseNumber: "MASK-B",
      arrestDate: new Date("2026-08-05"),
      persons: [
        {
          existingPersonId: personId,
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0900001999", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    }),
  );

  const service = new DrugCrossCaseConnectionService(db);
  const masked = await service.loadForCase(case2.caseId, { canViewFull: false });
  const phoneEv = masked.connections[0]!.evidenceItems.find((e) => e.entityType === "PHONE")!;
  assert.equal(phoneEv.displayValue, presentPhoneNumber("0900001999", false));
  assert.notEqual(phoneEv.displayValue, "0900001999");
});

test("same province alone does NOT create a connection", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "PROV-A",
      arrestDate: new Date("2026-08-01"),
      province: "ชุมพร",
      persons: [
        {
          newPerson: { primaryFullName: "A", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    }),
  );
  const caseB = await caseService.createCase(
    baseCase({
      caseNumber: "PROV-B",
      arrestDate: new Date("2026-08-05"),
      province: "ชุมพร",
      persons: [
        {
          newPerson: { primaryFullName: "B", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    }),
  );

  const result = await new DrugCrossCaseConnectionService(db).loadForCase(caseB.caseId, { canViewFull: true });
  assert.equal(result.connections.length, 0);
});

test("shared SIM and DEVICE evidence are supported", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const case1 = await caseService.createCase(
    baseCase({
      caseNumber: "SIM-A",
      arrestDate: new Date("2026-08-01"),
      persons: [
        {
          newPerson: { primaryFullName: "Sim Owner", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [{ iccid: "89000000000000009999", imsi: null, carrier: "AIS", firstSeenAt: null, lastSeenAt: null, notes: null }],
          devices: [
            {
              brand: "Apple",
              model: "iPhone",
              serialNumber: null,
              imei1: "111122223333444",
              imei2: null,
              firstSeenAt: null,
              lastSeenAt: null,
              notes: null,
            },
          ],
          vehicles: [],
        },
      ],
    }),
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: case1.caseId } }))[0] as { personId: string }).personId;
  const case2 = await caseService.createCase(
    baseCase({
      caseNumber: "SIM-B",
      arrestDate: new Date("2026-08-05"),
      persons: [
        {
          existingPersonId: personId,
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [{ iccid: "89000000000000009999", imsi: null, carrier: "AIS", firstSeenAt: null, lastSeenAt: null, notes: null }],
          devices: [
            {
              brand: "Apple",
              model: "iPhone",
              serialNumber: null,
              imei1: "111122223333444",
              imei2: null,
              firstSeenAt: null,
              lastSeenAt: null,
              notes: null,
            },
          ],
          vehicles: [],
        },
      ],
    }),
  );

  const result = await new DrugCrossCaseConnectionService(db).loadForCase(case2.caseId, { canViewFull: true });
  const types = new Set(result.connections[0]!.evidenceItems.map((e) => e.entityType));
  assert.ok(types.has("PERSON"));
  assert.ok(types.has("SIM"));
  assert.ok(types.has("DEVICE"));
});

test("CASE graph node does not expose first/last seen as arrestDate", () => {
  const src = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_network_graph_service.ts"), "utf8");
  assert.match(src, /DI-8\.2A: CASE is an event/);
  assert.doesNotMatch(src, /firstSeenAt: drugCase\.arrestDate/);
});
