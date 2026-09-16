/**
 * Create Case Step 4 — identifier field UX polish (carrier selector + ICCID/IMSI/IMEI guidance).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/create_case_identifier_ux.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";
import {
  buildCreateCaseRequest,
  createEmptyDraft,
  createEmptySeizedDeviceDraft,
  createEmptySeizedSimDraft,
  validateDraft,
} from "@/lib/drug_intelligence/create_case_draft";
import {
  SIM_CARRIER_KNOWN_VALUES,
  SIM_CARRIER_OTHER_SELECT,
  SIM_CARRIER_SELECT_OPTIONS,
  simCarrierPersistedValue,
  simCarrierSelectValue,
} from "@/lib/drug_intelligence/sim_carrier_options";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const PLACEHOLDERS = {
  iccid: "8966xxxxxxxxxxxxxxx",
  imsi: "52001xxxxxxxxxx",
  imei1: "356789123456789",
  imei2: "356789123456797",
  serial: "เช่น F2LXXXXXXX",
  phone: "เช่น 0812345678",
};

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "ID-UX-2569-001",
    title: "คดี identifier UX",
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

test("carrier selector offers AIS / True / dtac / NT / MVNO Other and is not a Prisma enum", () => {
  assert.deepEqual([...SIM_CARRIER_KNOWN_VALUES], ["AIS", "True", "dtac", "NT"]);
  assert.equal(SIM_CARRIER_OTHER_SELECT, "OTHER");
  assert.deepEqual(
    SIM_CARRIER_SELECT_OPTIONS.map((option) => option.value),
    ["AIS", "True", "dtac", "NT", "OTHER"]
  );
  assert.equal(SIM_CARRIER_SELECT_OPTIONS.find((option) => option.value === "OTHER")?.labelTh, "MVNO / อื่น ๆ");

  const schema = read("prisma/schema.prisma");
  const simBlock = schema.slice(schema.indexOf("model DrugSim {"), schema.indexOf("model DrugSimPhoneHistory {"));
  assert.doesNotMatch(simBlock, /enum.*Carrier|carrier\s+Drug/);
  assert.match(simBlock, /carrier\s+String\?/);
  assert.doesNotMatch(read("prisma/schema.prisma"), /enum DrugSimCarrier|enum SimCarrier/);
});

test("known carriers persist as the operator string; MVNO/Other persists the custom name, never OTHER", () => {
  assert.equal(simCarrierSelectValue("AIS"), "AIS");
  assert.equal(simCarrierSelectValue("True"), "True");
  assert.equal(simCarrierSelectValue("dtac"), "dtac");
  assert.equal(simCarrierSelectValue("NT"), "NT");
  assert.equal(simCarrierPersistedValue("AIS", "ignored"), "AIS");
  assert.equal(simCarrierPersistedValue("OTHER", "Penguin Telecom"), "Penguin Telecom");
  assert.equal(simCarrierPersistedValue("OTHER", "  "), "");
  assert.notEqual(simCarrierPersistedValue("OTHER", "Penguin Telecom"), "OTHER");
});

test("historical / non-known carrier strings stay OTHER in the selector and keep the original persisted value", () => {
  assert.equal(simCarrierSelectValue("DTAC"), "OTHER");
  assert.equal(simCarrierSelectValue("TOT"), "OTHER");
  assert.equal(simCarrierSelectValue("TrueMove H"), "OTHER");
  assert.equal(simCarrierPersistedValue("OTHER", "DTAC"), "DTAC");
  assert.equal(simCarrierPersistedValue("OTHER", "TOT"), "TOT");
  assert.equal(simCarrierSelectValue(""), "");
  assert.equal(simCarrierSelectValue("  "), "");
});

test("empty SIM/device drafts do not seed placeholder examples as values", () => {
  const sim = createEmptySeizedSimDraft();
  const device = createEmptySeizedDeviceDraft();
  assert.equal(sim.iccid, "");
  assert.equal(sim.imsi, "");
  assert.equal(sim.carrier, "");
  assert.equal(sim.associatedPhone, "");
  assert.equal(device.imei1, "");
  assert.equal(device.imei2, "");
  assert.equal(device.serialNumber, "");
  assert.equal(device.associatedPhone, "");
  for (const value of Object.values(PLACEHOLDERS)) {
    assert.notEqual(sim.iccid, value);
    assert.notEqual(sim.imsi, value);
    assert.notEqual(sim.associatedPhone, value);
    assert.notEqual(device.imei1, value);
    assert.notEqual(device.imei2, value);
    assert.notEqual(device.serialNumber, value);
    assert.notEqual(device.associatedPhone, value);
  }

  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.seizedSims.push(createEmptySeizedSimDraft());
  draft.seizedDevices.push(createEmptySeizedDeviceDraft());
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.seizedSims?.length ?? 0, 0);
  assert.equal(req.seizedDevices?.length ?? 0, 0);
  assert.equal(JSON.stringify(req).includes(PLACEHOLDERS.iccid), false);
  assert.equal(JSON.stringify(req).includes(PLACEHOLDERS.imei1), false);
});

test("ICCID / IMSI / IMEI / serial / phone labels, helpers, and placeholders are operator-facing", () => {
  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.seized\.carrierLabel": tr\("เครือข่าย \/ ผู้ให้บริการ"/);
  assert.match(dict, /"di\.seized\.carrierOtherLabel": tr\("ระบุเครือข่าย \/ ผู้ให้บริการ"/);
  assert.match(dict, /"di\.seized\.iccidLabel": tr\("ICCID \(หมายเลขประจำ SIM Card\)"/);
  assert.match(dict, /"di\.seized\.iccidHelper": tr\("เลขระบุ SIM ใบนี้โดยเฉพาะ มักพบที่ตัว SIM หรือซอง SIM"/);
  assert.match(dict, new RegExp(`"di\\.seized\\.iccidPlaceholder": tr\\("${PLACEHOLDERS.iccid}"`));
  assert.match(dict, /"di\.seized\.iccidLength": tr\("โดยทั่วไป 19–20 หลัก"/);
  assert.match(dict, /"di\.seized\.imsiLabel": tr\("IMSI \(หมายเลขประจำผู้ใช้ในเครือข่ายมือถือ\)"/);
  assert.match(dict, /"di\.seized\.imsiHelper": tr\("ใช้ระบุสมาชิกในระบบเครือข่าย หากไม่มีข้อมูลสามารถเว้นได้"/);
  assert.match(dict, new RegExp(`"di\\.seized\\.imsiPlaceholder": tr\\("${PLACEHOLDERS.imsi}"`));
  assert.match(dict, /"di\.seized\.imsiLength": tr\("โดยทั่วไปไม่เกิน 15 หลัก"/);
  assert.match(dict, /"di\.seized\.imei1Label": tr\("IMEI 1 \(หมายเลขประจำเครื่อง\)"/);
  assert.match(dict, /"di\.seized\.imei1Helper": tr\("เลขประจำตัวเครื่อง ใช้ตรวจสอบการพบอุปกรณ์เดียวกันในคดีอื่น"/);
  assert.match(dict, new RegExp(`"di\\.seized\\.imei1Placeholder": tr\\("${PLACEHOLDERS.imei1}"`));
  assert.match(dict, /"di\.seized\.imei2Label": tr\("IMEI 2 \(หมายเลขประจำเครื่อง SIM 2\)"/);
  assert.match(dict, new RegExp(`"di\\.seized\\.imei2Placeholder": tr\\("${PLACEHOLDERS.imei2}"`));
  assert.match(dict, /"di\.seized\.imeiPlaceholderLength": tr\("โดยทั่วไป 15 หลัก"/);
  assert.match(dict, /"di\.seized\.deviceSerialLabel": tr\("Serial Number \(หมายเลขเครื่องจากผู้ผลิต\)"/);
  assert.match(dict, /"di\.seized\.deviceSerialPlaceholder": tr\("เช่น F2LXXXXXXX"/);
  assert.match(dict, /"di\.seized\.associatedPhone": tr\("หมายเลขโทรศัพท์ \(ถ้ามี\)"/);
  assert.match(dict, /"di\.seized\.phonePlaceholder": tr\("เช่น 0812345678"/);
  assert.match(dict, /"di\.seized\.phoneWithDeviceHelper": tr\("บันทึกเมื่อพบหมายเลขนี้ร่วมกับอุปกรณ์ ไม่ได้หมายความว่าเป็นเจ้าของ"/);

  const evidence = read("components/drug_intelligence/create_case_evidence_step.tsx");
  assert.match(evidence, /placeholder=\{t\("di\.seized\.iccidPlaceholder"\)\}/);
  assert.match(evidence, /placeholder=\{t\("di\.seized\.imsiPlaceholder"\)\}/);
  assert.match(evidence, /placeholder=\{t\("di\.seized\.imei1Placeholder"\)\}/);
  assert.match(evidence, /placeholder=\{t\("di\.seized\.imei2Placeholder"\)\}/);
  assert.match(evidence, /placeholder=\{t\("di\.seized\.deviceSerialPlaceholder"\)\}/);
  assert.match(evidence, /placeholder=\{t\("di\.seized\.phonePlaceholder"\)\}/);
  assert.match(evidence, /grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.match(evidence, /overflow-x-hidden/);
  assert.doesNotMatch(evidence, /value=\{t\("di\.seized\.(iccid|imsi|imei1|imei2|deviceSerial|phone)Placeholder"\)\}/);
});

test("placeholders are display-only attributes, never draft or request defaults", () => {
  const evidence = read("components/drug_intelligence/create_case_evidence_step.tsx");
  for (const example of Object.values(PLACEHOLDERS)) {
    assert.equal(evidence.includes(`value="${example}"`), false);
    assert.equal(evidence.includes(`value={'${example}'}`), false);
    assert.equal(evidence.includes(`value={"${example}"}`), false);
  }
  const draftSrc = read("lib/drug_intelligence/create_case_draft.ts");
  assert.doesNotMatch(draftSrc, /8966xxxxxxxxxxxxxxx|52001xxxxxxxxxx|356789123456789|356789123456797|F2LXXXXXXX/);
});

test("IMSI is optional; unusual ICCID/IMEI lengths are not hard-rejected; serial stays alphanumeric", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  const sim = createEmptySeizedSimDraft();
  sim.iccid = "89661818";
  sim.imsi = "";
  draft.seizedSims.push(sim);
  const device = createEmptySeizedDeviceDraft();
  device.imei1 = "35391812345678";
  device.serialNumber = "F2L-ABC-99";
  draft.seizedDevices.push(device);
  const errors = validateDraft(draft);
  assert.equal(errors.some((error) => (error.field ?? "").startsWith("seizedSim") || (error.field ?? "").startsWith("seizedDevice")), false);

  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.seizedSims?.[0]?.imsi, null);
  assert.equal(req.seizedSims?.[0]?.iccid, "89661818");
  assert.equal(req.seizedDevices?.[0]?.serialNumber, "F2L-ABC-99");
  assert.equal(req.seizedDevices?.[0]?.imei1, "35391812345678");
});

test("DrugDevice has no persisted type/category field, so Step 4 does not invent a device-type selector", () => {
  const schema = read("prisma/schema.prisma");
  const deviceStart = schema.indexOf("model DrugDevice {");
  const deviceEnd = schema.indexOf("model DrugPersonDevice {");
  const deviceBlock = schema.slice(deviceStart, deviceEnd);
  assert.match(deviceBlock, /brand\s+String\?/);
  assert.match(deviceBlock, /imei1\s+String\?/);
  assert.doesNotMatch(deviceBlock, /deviceType|category|formFactor/);
  const evidence = read("components/drug_intelligence/create_case_evidence_step.tsx");
  assert.doesNotMatch(evidence, /ประเภทอุปกรณ์|Mobile Wi-Fi|โทรศัพท์มือถือ \/ Smartphone/);
  assert.doesNotMatch(read("lib/drug_intelligence/create_case_draft.ts"), /deviceType/);
});

test("canonical SIM matching remains ICCID; IMSI is not a dedupe key; no Person ownership or CDR", async () => {
  const repo = read("lib/database/repositories/drug_entity_repository.ts");
  const simFn = repo.slice(repo.indexOf("async findOrCreateSim"), repo.indexOf("async linkCaseSim"));
  assert.match(simFn, /findUnique\(\{ where: \{ iccid: input\.iccid \} \}\)/);
  assert.doesNotMatch(simFn, /where: \{ imsi/);
  assert.doesNotMatch(simFn, /findFirst\([\s\S]*imsi/);

  const persist = read("lib/drug_intelligence/drug_case_service.ts");
  const persistFn = persist.slice(persist.indexOf("persistCaseLevelEvidence"), persist.indexOf("persistCaseLevelEvidence") + 5000);
  assert.match(persistFn, /personId: null/);
  assert.doesNotMatch(persistFn, /linkPersonDevice|linkPersonSim|linkPersonPhone/);
  assert.doesNotMatch(persistFn, /caller|callee|callRelationship|DrugCdr|createCdr/);

  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const first = await service.createCase(
    baseCase({
      caseNumber: "ID-UX-SIM-A",
      seizedSims: [{ iccid: "8966000000000000099", imsi: "520011111111111", carrier: "AIS", associatedPhone: null, notes: null }],
    })
  );
  const second = await service.createCase(
    baseCase({
      caseNumber: "ID-UX-SIM-B",
      seizedSims: [{ iccid: "8966000000000000099", imsi: "520019999999999", carrier: "Penguin Telecom", associatedPhone: null, notes: null }],
    })
  );
  const byIccid = await db.drugSim.findMany({ where: { iccid: "8966000000000000099" } });
  assert.equal(byIccid.length, 1);
  assert.equal(byIccid[0].imsi, "520011111111111");
  assert.equal(byIccid[0].carrier, "AIS");
  assert.equal(first.caseId === second.caseId, false);
  assert.equal((await db.drugPerson.findMany({})).length, 0);
  const caseSims = await db.drugCaseSim.findMany({});
  assert.equal(caseSims.every((row) => row.personId == null), true);
  assert.equal((await db.drugPhoneNumber.findMany({})).length, 0);
});

test("MVNO custom carrier and known AIS persist as carrier strings, never the OTHER token", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(
    baseCase({
      caseNumber: "ID-UX-CARRIER",
      seizedSims: [
        { iccid: "8966000000000000101", imsi: null, carrier: "AIS", associatedPhone: null, notes: null },
        { iccid: "8966000000000000102", imsi: null, carrier: "Penguin Telecom", associatedPhone: null, notes: null },
        { iccid: "8966000000000000103", imsi: null, carrier: "DTAC", associatedPhone: null, notes: null },
      ],
    })
  );
  const ais = await db.drugSim.findMany({ where: { iccid: "8966000000000000101" } });
  const mvno = await db.drugSim.findMany({ where: { iccid: "8966000000000000102" } });
  const historic = await db.drugSim.findMany({ where: { iccid: "8966000000000000103" } });
  assert.equal(ais[0].carrier, "AIS");
  assert.equal(mvno[0].carrier, "Penguin Telecom");
  assert.equal(historic[0].carrier, "DTAC");
  for (const row of [ais[0], mvno[0], historic[0]]) {
    assert.notEqual(String(row.carrier), "OTHER");
  }
});

test("no check-digit invention and no new migration in this polish round", () => {
  const evidence = read("components/drug_intelligence/create_case_evidence_step.tsx");
  const carrier = read("lib/drug_intelligence/sim_carrier_options.ts");
  const draft = read("lib/drug_intelligence/create_case_draft.ts");
  for (const src of [evidence, carrier, draft]) {
    assert.doesNotMatch(src, /luhn|checkDigit|check-digit|mod 10|mod10/i);
  }
  const migrations = read("prisma/migrations/20260917000000_drug_case_evidence_and_optional_case_phone_person/migration.sql");
  assert.match(migrations, /DrugCaseEvidenceItem|personId/);
});
