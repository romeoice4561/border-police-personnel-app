/**
 * Create Case Step 4 — multi-category seized evidence + canonical entity linking.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/create_case_multi_category_evidence.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";
import {
  buildCreateCaseRequest,
  createEmptyDraft,
  createEmptySeizedDeviceDraft,
  createEmptySeizedFirearmDraft,
  createEmptySeizedItemDraft,
  createEmptySeizedOtherDraft,
  createEmptySeizedSimDraft,
  createEmptySeizedVehicleDraft,
  evidenceReviewGroups,
  validateDraft,
} from "@/lib/drug_intelligence/create_case_draft";
import { kilogramsToGrams } from "@/lib/drug_intelligence/drug_seized_item_analytics";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "EV-2569-001",
    title: "คดีของกลางหลายหมวด",
    status: "OPEN",
    arrestDate: new Date("2026-03-01"),
    arrestTime: "09:00",
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

function filledDraft(): ReturnType<typeof createEmptyDraft> {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  return draft;
}

test("A: one drug item and ยาบ้า + ไอซ์ remain two COUNT/MASS rows", () => {
  const draft = filledDraft();
  const yaba = createEmptySeizedItemDraft();
  yaba.drugCategory = "METHAMPHETAMINE_TABLET";
  yaba.measurementKind = "COUNT";
  yaba.drugType = "ยาบ้า";
  yaba.quantity = "12000";
  yaba.unit = "เม็ด";
  yaba.packageCount = "10";
  const ice = createEmptySeizedItemDraft();
  ice.drugCategory = "CRYSTAL_METHAMPHETAMINE";
  ice.measurementKind = "MASS";
  ice.drugType = "ไอซ์";
  ice.weightKilograms = "2.35";
  draft.seizedItems.push(yaba, ice);

  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.seizedItems.length, 2);
  assert.equal(req.seizedItems[0].measurementKind, "COUNT");
  assert.equal(req.seizedItems[0].quantity, 12000);
  assert.equal(req.seizedItems[0].weightGrams, null);
  assert.equal(req.seizedItems[0].packageCount, 10);
  assert.equal(req.seizedItems[1].measurementKind, "MASS");
  assert.equal(req.seizedItems[1].quantity, null);
  assert.equal(req.seizedItems[1].weightGrams, kilogramsToGrams(2.35));
});

test("B: multiple vehicles reuse canonical identity, skip duplicate junction, preserve metadata", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const first = await service.createCase(
    baseCase({
      caseNumber: "EV-CAR-A",
      seizedVehicles: [
        {
          registrationNumber: "TEST-9009",
          registrationProvince: "กรุงเทพมหานคร",
          vehicleType: "รถยนต์",
          brand: "Toyota",
          model: "Hilux",
          color: "ขาว",
          vin: null,
          notes: "ต้นฉบับ",
        },
        {
          registrationNumber: "กก-1111",
          registrationProvince: "เชียงราย",
          vehicleType: "รถจักรยานยนต์",
          brand: "Honda",
          model: "Wave",
          color: "แดง",
          vin: null,
          notes: null,
        },
      ],
    })
  );

  const second = await service.createCase(
    baseCase({
      caseNumber: "EV-CAR-B",
      seizedVehicles: [
        {
          registrationNumber: "TEST-9009",
          registrationProvince: "กรุงเทพมหานคร",
          vehicleType: "รถยนต์",
          brand: "Honda",
          model: "Civic",
          color: "ดำ",
          vin: null,
          notes: "ต้องไม่ทับ",
        },
        {
          registrationNumber: "TEST-9009",
          registrationProvince: "กรุงเทพมหานคร",
          vehicleType: "รถยนต์",
          brand: "Mazda",
          model: "2",
          color: "เทา",
          vin: null,
          notes: "ซ้ำในคดีเดียวกัน",
        },
      ],
    })
  );

  const vehicles = await db.drugVehicle.findMany({});
  const matched = vehicles.filter((v) => v.registrationNumber === "TEST-9009");
  assert.equal(matched.length, 1);
  assert.equal(matched[0].brand, "Toyota");
  assert.equal(matched[0].model, "Hilux");

  const links = await db.drugCaseVehicle.findMany({ where: { vehicleId: matched[0].id } });
  assert.equal(links.length, 2);
  assert.ok(links.every((link) => link.personId === null));
  assert.equal(links.filter((link) => link.caseId === second.caseId).length, 1);

  const personLinks = await db.drugPersonVehicle.findMany({});
  assert.equal(personLinks.length, 0);

  const firstDetail = await service.getCase(first.caseId);
  assert.equal(firstDetail.vehicles.length, 2);
  assert.equal(firstDetail.vehicles.every((row) => row.personId === null), true);
});

test("C: multiple devices reuse IMEI and never create Person ownership", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const imei = "490154203237518";

  await service.createCase(
    baseCase({
      caseNumber: "EV-DEV-A",
      seizedDevices: [
        { brand: "Samsung", model: "A12", serialNumber: null, imei1: imei, imei2: null, associatedPhone: null, notes: "ต้นฉบับ" },
        { brand: "Oppo", model: "A16", serialNumber: "SN-2", imei1: "111111111111111", imei2: null, associatedPhone: null, notes: null },
      ],
    })
  );
  await service.createCase(
    baseCase({
      caseNumber: "EV-DEV-B",
      seizedDevices: [{ brand: "Xiaomi", model: "Redmi", serialNumber: null, imei1: imei, imei2: null, associatedPhone: null, notes: "ทับไม่ได้" }],
    })
  );

  const devices = await db.drugDevice.findMany({ where: { imei1: imei } });
  assert.equal(devices.length, 1);
  assert.equal(devices[0].brand, "Samsung");
  const personDevices = await db.drugPersonDevice.findMany({ where: { deviceId: devices[0].id } });
  assert.equal(personDevices.length, 0);
  const caseLinks = await db.drugCaseDevice.findMany({ where: { deviceId: devices[0].id } });
  assert.equal(caseLinks.length, 2);
  assert.ok(caseLinks.every((link) => link.personId === null));
});

test("D: multiple SIMs reuse ICCID and never create Person ownership", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const iccid = "8966000000000000001";

  await service.createCase(
    baseCase({
      caseNumber: "EV-SIM-A",
      seizedSims: [
        { iccid, imsi: "520000000000001", carrier: "AIS", associatedPhone: "0811112222", notes: null },
        { iccid: "8966000000000000002", imsi: null, carrier: null, associatedPhone: null, notes: null },
      ],
    })
  );
  await service.createCase(
    baseCase({
      caseNumber: "EV-SIM-B",
      seizedSims: [{ iccid, imsi: "999", carrier: "DTAC", associatedPhone: "0899998888", notes: "ทับไม่ได้" }],
    })
  );

  const sims = await db.drugSim.findMany({ where: { iccid } });
  assert.equal(sims.length, 1);
  assert.equal(sims[0].carrier, "AIS");
  const caseSims = await db.drugCaseSim.findMany({ where: { simId: sims[0].id } });
  assert.equal(caseSims.length, 2);
  assert.ok(caseSims.every((link) => link.personId === null));
});

test("E: normalized same phone reuses entity without Person ownership or CDR", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  await service.createCase(
    baseCase({
      caseNumber: "EV-TEL-A",
      seizedDevices: [{ brand: null, model: null, serialNumber: null, imei1: null, imei2: null, associatedPhone: "081-234-5678", notes: null }],
    })
  );
  await service.createCase(
    baseCase({
      caseNumber: "EV-TEL-B",
      seizedDevices: [{ brand: null, model: null, serialNumber: null, imei1: null, imei2: null, associatedPhone: "0812345678", notes: null }],
    })
  );

  const phones = await db.drugPhoneNumber.findMany({});
  assert.equal(phones.length, 1);
  const links = await db.drugCasePhone.findMany({ where: { phoneNumberId: phones[0].id } });
  assert.equal(links.length, 2);
  assert.ok(links.every((link) => link.personId === null));
  assert.equal((await db.drugPerson.findMany({})).length, 0);
});

test("F: firearm and other evidence persist as evidence rows, not Network entities", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      seizedEvidenceItems: [
        { kind: "FIREARM", label: "ปืนพก", quantity: 1, unit: null, serialNumber: "GLOCK-1", brand: "Glock", model: "19", caliberOrSize: "9มม.", recordedDescription: "ปืนพก 1 กระบอก", notes: null },
        { kind: "FIREARM", label: "ปืนลูกซอง", quantity: 1, unit: null, serialNumber: null, brand: null, model: null, caliberOrSize: null, recordedDescription: null, notes: null },
        { kind: "OTHER", label: "มีด", quantity: 2, unit: "เล่ม", serialNumber: "KN-1", brand: null, model: null, caliberOrSize: null, recordedDescription: "มีดพก", notes: null },
      ],
    })
  );

  const items = await db.drugCaseEvidenceItem.findMany({ where: { caseId: result.caseId } });
  assert.equal(items.length, 3);
  assert.equal(items.filter((item) => item.kind === "FIREARM").length, 2);
  assert.equal(items.filter((item) => item.kind === "OTHER").length, 1);

  const detail = await service.getCase(result.caseId);
  assert.equal(detail.evidenceItems.length, 3);
  assert.equal(detail.seizedItemCount, 3);

  const graph = new DrugNetworkGraphService(db);
  const neighborhood = await graph.getNeighborhood({ entityType: "CASE", entityId: result.caseId, depth: 1 }, { canViewFull: true });
  assert.equal(neighborhood.nodes.filter((node) => node.type !== "CASE").length, 0);
  assert.equal(neighborhood.edges.length, 0);
});

test("G: draft Step 4 → 5 → 4 preserves every evidence category", () => {
  const draft = filledDraft();
  draft.seizedItems.push(createEmptySeizedItemDraft());
  draft.seizedVehicles.push(createEmptySeizedVehicleDraft());
  draft.seizedDevices.push(createEmptySeizedDeviceDraft());
  draft.seizedSims.push(createEmptySeizedSimDraft());
  draft.seizedFirearms.push(createEmptySeizedFirearmDraft());
  draft.seizedOtherItems.push(createEmptySeizedOtherDraft());
  draft.seizedVehicles[0].registrationNumber = "TEST-9009";
  draft.seizedVehicles[0].registrationProvince = "เชียงราย";

  const afterLocationStep = { ...draft, locations: [...draft.locations] };
  assert.equal(afterLocationStep.seizedItems.length, 1);
  assert.equal(afterLocationStep.seizedVehicles.length, 1);
  assert.equal(afterLocationStep.seizedDevices.length, 1);
  assert.equal(afterLocationStep.seizedSims.length, 1);
  assert.equal(afterLocationStep.seizedFirearms.length, 1);
  assert.equal(afterLocationStep.seizedOtherItems.length, 1);
  assert.equal(afterLocationStep.seizedVehicles[0].registrationNumber, "TEST-9009");

  const page = read("app/drug-intelligence/cases/new/page.tsx");
  assert.match(page, /useState<CreateCaseDraft>\(createEmptyDraft\)/);
  assert.match(page, /CreateCaseEvidenceStep/);
});

test("H: Step 6 review groups and counts categories", () => {
  const draft = filledDraft();
  const yaba = createEmptySeizedItemDraft();
  yaba.drugType = "ยาบ้า";
  yaba.measurementKind = "COUNT";
  yaba.quantity = "12000";
  yaba.unit = "เม็ด";
  const ice = createEmptySeizedItemDraft();
  ice.drugType = "ไอซ์";
  ice.measurementKind = "MASS";
  ice.weightKilograms = "2.350";
  draft.seizedItems.push(yaba, ice);
  const vehicle = createEmptySeizedVehicleDraft();
  vehicle.brand = "Toyota";
  vehicle.model = "Hilux";
  vehicle.registrationNumber = "TEST-9009";
  draft.seizedVehicles.push(vehicle);
  draft.seizedDevices.push(createEmptySeizedDeviceDraft(), createEmptySeizedDeviceDraft());
  draft.seizedDevices[0].imei1 = "1";
  draft.seizedDevices[1].imei1 = "2";
  draft.seizedSims.push(createEmptySeizedSimDraft(), createEmptySeizedSimDraft(), createEmptySeizedSimDraft());
  draft.seizedSims[0].iccid = "a";
  draft.seizedSims[1].iccid = "b";
  draft.seizedSims[2].iccid = "c";
  const firearm = createEmptySeizedFirearmDraft();
  firearm.firearmType = "ปืนพก";
  draft.seizedFirearms.push(firearm);

  const groups = evidenceReviewGroups(draft);
  assert.equal(groups.find((g) => g.key === "drugs")?.count, 2);
  assert.equal(groups.find((g) => g.key === "vehicles")?.count, 1);
  assert.equal(groups.find((g) => g.key === "devices")?.count, 2);
  assert.equal(groups.find((g) => g.key === "sims")?.count, 3);
  assert.equal(groups.find((g) => g.key === "firearms")?.count, 1);
  assert.match(groups.find((g) => g.key === "drugs")?.lines.join("\n") ?? "", /ยาบ้า/);
  assert.match(groups.find((g) => g.key === "drugs")?.lines.join("\n") ?? "", /ไอซ์/);
  assert.match(groups.find((g) => g.key === "vehicles")?.lines[0] ?? "", /TEST-9009/);
  assert.doesNotMatch(groups.find((g) => g.key === "vehicles")?.lines.join(" ") ?? "", /cuid|cl[a-z0-9]{20,}/i);

  const review = read("components/drug_intelligence/create_case_review_step.tsx");
  assert.match(review, /evidenceReviewGroups/);
  assert.match(review, /onJumpToStep\("seized"\)/);
});

test("I: drug-only creation, investigator contact, and unit-role flow remain intact", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      investigatorName: "สมชาย ทดสอบ",
      investigatorPhone: "0999999999",
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 100, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null },
      ],
    })
  );
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.investigatorName, "สมชาย ทดสอบ");
  assert.ok(stored?.investigatorPhone);
  const detail = await service.getCase(result.caseId);
  assert.equal(detail.seizedItems.length, 1);
  assert.equal(detail.vehicles.length, 0);
  assert.equal((await db.drugPhoneNumber.findMany({})).length, 0);

  const units = read("components/drug_intelligence/create_case_arrest_step.tsx");
  assert.match(units, /ourArrestRole/);
  assert.match(read("lib/drug_intelligence/create_case_draft.ts"), /investigatorName/);
});

test("J: persistence is findOrCreate + case-scoped links, not fetch-all", () => {
  const serviceSrc = read("lib/drug_intelligence/drug_case_service.ts");
  const persistStart = serviceSrc.indexOf("persistCaseLevelEvidence");
  assert.ok(persistStart > 0);
  const persist = serviceSrc.slice(persistStart, persistStart + 4500);
  assert.match(persist, /findOrCreateVehicle/);
  assert.match(persist, /findOrCreateDevice/);
  assert.match(persist, /findOrCreateSim/);
  assert.match(persist, /findOrCreatePhoneNumber/);
  assert.doesNotMatch(persist, /findAllVehicles|findAllDevices|findAllSims|findAllPhoneNumbers/);
  assert.match(persist, /personId: null/);
  assert.doesNotMatch(persist, /linkPersonDevice|linkPersonVehicle/);
});

test("validation identifies the exact card", () => {
  const draft = filledDraft();
  draft.seizedVehicles.push(createEmptySeizedVehicleDraft());
  draft.seizedVehicles[0].brand = "Toyota";
  draft.seizedDevices.push(createEmptySeizedDeviceDraft());
  draft.seizedDevices[0].brand = "Samsung";
  draft.seizedFirearms.push(createEmptySeizedFirearmDraft());
  draft.seizedFirearms[0].quantity = "1";
  draft.seizedOtherItems.push(createEmptySeizedOtherDraft());
  draft.seizedOtherItems[0].quantity = "3";
  const errors = validateDraft(draft);
  assert.ok(errors.some((e) => e.message === "ยานพาหนะ #1: กรุณาระบุทะเบียนหรือ VIN"));
  assert.ok(errors.some((e) => e.message.includes("โทรศัพท์/อุปกรณ์ #1")));
  assert.ok(errors.some((e) => e.message === "อาวุธปืน #1: กรุณาระบุประเภทอาวุธ"));
  assert.ok(errors.some((e) => e.message === "ของกลางอื่น ๆ #1: กรุณาระบุชื่อของกลาง"));
});

test("UX: Step 4 uses category picker and canonical case-detail sections", () => {
  const evidence = read("components/drug_intelligence/create_case_evidence_step.tsx");
  assert.match(evidence, /di\.seized\.catDrugs/);
  assert.match(evidence, /di\.seized\.catVehicles/);
  assert.match(evidence, /di\.seized\.catDevices/);
  assert.match(evidence, /di\.seized\.catSims/);
  assert.match(evidence, /di\.seized\.catFirearms/);
  assert.match(evidence, /di\.seized\.catOther/);
  assert.match(evidence, /di\.seized\.vehicleHelper/);
  assert.match(evidence, /di\.seized\.deviceHelper/);
  assert.match(evidence, /di\.seized\.simHelper/);
  assert.match(evidence, /di\.seized\.carrierLabel/);
  assert.match(evidence, /SIM_CARRIER_SELECT_OPTIONS/);
  assert.match(evidence, /di\.seized\.iccidLabel/);
  assert.match(evidence, /di\.seized\.imsiLabel/);
  assert.match(evidence, /di\.seized\.imei1Label/);
  assert.match(evidence, /di\.seized\.imei2Label/);
  assert.match(evidence, /di\.seized\.deviceSerialLabel/);
  assert.match(evidence, /di\.seized\.phoneWithDeviceHelper/);
  assert.match(evidence, /placeholder=\{t\("di\.seized\.iccidPlaceholder"\)\}/);
  assert.doesNotMatch(evidence, /owns this|caller|callee|CDR/i);
  assert.doesNotMatch(evidence, /ประเภทอุปกรณ์|deviceType|deviceCategory/);

  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.create\.stepSeized": tr\("ของกลางและวัตถุพยาน"/);

  const detail = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(detail, /evidenceItems/);
  assert.match(detail, /di\.review\.seizedSummary/);
  assert.doesNotMatch(detail, /phone\.personId, undefined\);/);
});

test("cross-case vehicle is the same canonical entity on the Network", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const a = await service.createCase(
    baseCase({
      caseNumber: "NET-CAR-A",
      seizedVehicles: [{ registrationNumber: "TEST-9009", registrationProvince: "กรุงเทพมหานคร", vehicleType: null, brand: "Toyota", model: "Hilux", color: null, vin: null, notes: null }],
    })
  );
  const b = await service.createCase(
    baseCase({
      caseNumber: "NET-CAR-B",
      seizedVehicles: [{ registrationNumber: "TEST-9009", registrationProvince: "กรุงเทพมหานคร", vehicleType: null, brand: "Toyota", model: "Hilux", color: null, vin: null, notes: null }],
    })
  );
  const graph = new DrugNetworkGraphService(db);
  const fromA = await graph.getNeighborhood({ entityType: "CASE", entityId: a.caseId, depth: 1 }, { canViewFull: true });
  assert.equal(fromA.nodes.filter((node) => node.type === "VEHICLE").length, 1);
  assert.ok(fromA.edges.some((edge) => edge.relationshipType === "CASE_VEHICLE"));
  assert.equal(fromA.edges.some((edge) => edge.relationshipType === "PERSON_VEHICLE"), false);
  const vehicleId = fromA.nodes.find((node) => node.type === "VEHICLE")?.id;
  assert.ok(vehicleId);
  const fromVehicle = await graph.getNeighborhood({ entityType: "VEHICLE", entityId: vehicleId, depth: 1 }, { canViewFull: true });
  const caseIds = fromVehicle.nodes.filter((node) => node.type === "CASE").map((node) => node.id).sort();
  assert.deepEqual(caseIds, [a.caseId, b.caseId].sort());
});
