/**
 * Unit tests for DrugEntityDetailService (Phase DI-3, Sections 12-16) over
 * the in-memory fake DatabaseClient.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import {
  DrugEntityDetailService,
  DrugPhoneNotFoundError,
  DrugSimNotFoundError,
  DrugDeviceNotFoundError,
  DrugVehicleNotFoundError,
} from "@/lib/drug_intelligence/drug_entity_detail_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "DETAIL-TEST",
    title: "คดีทดสอบรายละเอียด",
    status: "OPEN",
    arrestDate: new Date("2026-03-01"),
    arrestTime: "09:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
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

test("getPhoneDetail(): resolves related persons and source cases", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "PHONE-DETAIL-1",
      persons: [
        {
          newPerson: { primaryFullName: "โทรศัพท์ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0812223333", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-02-01"), notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const phoneRow = (await db.drugPhoneNumber.findMany({}))[0] as { id: string; normalizedNumber: string };
  const detailService = new DrugEntityDetailService(db);
  const detail = await detailService.getPhoneDetail(phoneRow.id);

  assert.equal(detail.relatedPersons.length, 1);
  assert.equal(detail.relatedPersons[0].primaryFullName, "โทรศัพท์ ทดสอบ");
  assert.equal(detail.caseCount, 1);
  assert.equal(detail.firstSeenAt.toISOString().slice(0, 10), "2026-01-01");
  assert.equal(detail.lastSeenAt.toISOString().slice(0, 10), "2026-02-01");
});

test("getPhoneDetail(): throws DrugPhoneNotFoundError for a missing id", async () => {
  const db = new InMemoryDatabaseClient();
  const detailService = new DrugEntityDetailService(db);
  await assert.rejects(() => detailService.getPhoneDetail("nonexistent"), DrugPhoneNotFoundError);
});

test("getSimDetail(): resolves ICCID/IMSI and related persons", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SIM-DETAIL-1",
      persons: [
        {
          newPerson: { primaryFullName: "ซิม ทดสอบราย", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [{ iccid: "8966009988776655443", imsi: "520031234567890", carrier: "DTAC", firstSeenAt: null, lastSeenAt: null, notes: null }],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const simRow = (await db.drugSim.findMany({}))[0] as { id: string };
  const detailService = new DrugEntityDetailService(db);
  const detail = await detailService.getSimDetail(simRow.id);

  assert.equal(detail.sim.iccid, "8966009988776655443");
  assert.equal(detail.sim.imsi, "520031234567890");
  assert.equal(detail.relatedPersons.length, 1);
});

test("getSimDetail(): throws DrugSimNotFoundError for a missing id", async () => {
  const db = new InMemoryDatabaseClient();
  const detailService = new DrugEntityDetailService(db);
  await assert.rejects(() => detailService.getSimDetail("nonexistent"), DrugSimNotFoundError);
});

test("getDeviceDetail(): resolves brand/model/IMEI and related persons across a durable link", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "DEVICE-DETAIL-1",
      persons: [
        {
          newPerson: { primaryFullName: "อุปกรณ์ ทดสอบราย", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [{ brand: "Apple", model: "iPhone 15", serialNumber: null, imei1: "356789101234599", imei2: null, firstSeenAt: new Date("2026-01-05"), lastSeenAt: new Date("2026-01-20"), notes: null }],
          vehicles: [],
        },
      ],
    })
  );

  const deviceRow = (await db.drugDevice.findMany({}))[0] as { id: string };
  const detailService = new DrugEntityDetailService(db);
  const detail = await detailService.getDeviceDetail(deviceRow.id);

  assert.equal(detail.device.brand, "Apple");
  assert.equal(detail.device.imei1, "356789101234599");
  assert.equal(detail.relatedPersons.length, 1);
  assert.equal(detail.caseCount, 1);
  assert.equal(detail.firstSeenAt.toISOString().slice(0, 10), "2026-01-05");
});

test("getDeviceDetail(): throws DrugDeviceNotFoundError for a missing id", async () => {
  const db = new InMemoryDatabaseClient();
  const detailService = new DrugEntityDetailService(db);
  await assert.rejects(() => detailService.getDeviceDetail("nonexistent"), DrugDeviceNotFoundError);
});

test("getVehicleDetail(): resolves registration/province and related persons", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "VEHICLE-DETAIL-1",
      persons: [
        {
          newPerson: { primaryFullName: "รถ ทดสอบราย", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [{ registrationNumber: "ขค9999", registrationProvince: "เชียงใหม่", vehicleType: null, brand: "Honda", model: "Civic", color: "ดำ", vin: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
        },
      ],
    })
  );

  const vehicleRow = (await db.drugVehicle.findMany({}))[0] as { id: string };
  const detailService = new DrugEntityDetailService(db);
  const detail = await detailService.getVehicleDetail(vehicleRow.id);

  assert.equal(detail.vehicle.registrationNumber, "ขค9999");
  assert.equal(detail.vehicle.registrationProvince, "เชียงใหม่");
  assert.equal(detail.relatedPersons.length, 1);
  assert.equal(detail.caseCount, 1);
});

test("getVehicleDetail(): throws DrugVehicleNotFoundError for a missing id", async () => {
  const db = new InMemoryDatabaseClient();
  const detailService = new DrugEntityDetailService(db);
  await assert.rejects(() => detailService.getVehicleDetail("nonexistent"), DrugVehicleNotFoundError);
});

test("entity reuse: a device shared across two cases/persons shows BOTH related persons and BOTH cases in its detail", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const sharedImei = "999888777666555";

  await caseService.createCase(
    baseCase({
      caseNumber: "SHARED-DEVICE-A",
      persons: [{ newPerson: { primaryFullName: "คนแรก", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [{ brand: "Xiaomi", model: null, serialNumber: null, imei1: sharedImei, imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }], vehicles: [] }],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "SHARED-DEVICE-B",
      persons: [{ newPerson: { primaryFullName: "คนที่สอง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [{ brand: "Xiaomi", model: null, serialNumber: null, imei1: sharedImei, imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }], vehicles: [] }],
    })
  );

  const deviceRows = await db.drugDevice.findMany({ where: { imei1: sharedImei } });
  assert.equal(deviceRows.length, 1, "the SAME device row should be reused across both cases (DI-1 find-or-create)");

  const detailService = new DrugEntityDetailService(db);
  const detail = await detailService.getDeviceDetail((deviceRows[0] as { id: string }).id);

  assert.equal(detail.relatedPersons.length, 2);
  assert.equal(detail.caseCount, 2);
});
