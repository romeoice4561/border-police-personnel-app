/**
 * DI-9.5.4 — Device + Vehicle intelligence detail presentation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DrugEntityHero,
  DrugEntityInfoNotice,
  DrugEntityRelatedCaseList,
  DrugRelatedPersonCard,
} from "@/components/drug_intelligence/drug_entity_detail_layout";
import {
  DRUG_ENTITY_DETAIL_TONE,
  explanationContainsForbiddenEntityClaim,
  presentDevicePrimaryIdentity,
  presentVehiclePrimaryIdentity,
  relatedIntelligenceFromKnownDto,
  shouldShowRecurrenceBadge,
} from "@/lib/drug_intelligence/drug_entity_detail_presentation";
import {
  ENTITY_DETAIL_SEARCH_FALLBACK,
  entityDetailBackHref,
  getSafeReturnTo,
} from "@/lib/ui/return_context";
import { entityDetailBackLabelKey } from "@/lib/ui/return_to_back_label";
import { drugEntityDetailHref, drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const NETWORK_HREF =
  "/drug-intelligence/network?focusType=PERSON&focusId=04d2ac30-976a-460d-b77d-31e74153e59f&depth=2&view=by-depth&from=CASE:case-003&fromLabels=DI-TEST-003";

test("1. Device identity prefers brand+model, then IMEI, then serial", () => {
  assert.equal(
    presentDevicePrimaryIdentity({
      brand: "Apple",
      model: "iPhone 14",
      imei1Display: "356789101234599",
      serialDisplay: "SN-1",
      fallback: "ข้อมูลอุปกรณ์",
    }),
    "Apple iPhone 14"
  );
  assert.equal(
    presentDevicePrimaryIdentity({
      brand: null,
      model: null,
      imei1Display: "356xxx4599",
      serialDisplay: "SN-1",
      fallback: "ข้อมูลอุปกรณ์",
    }),
    "356xxx4599"
  );
  assert.equal(
    presentDevicePrimaryIdentity({
      brand: null,
      model: null,
      imei1Display: null,
      serialDisplay: "SN-1",
      fallback: "ข้อมูลอุปกรณ์",
    }),
    "SN-1"
  );
  const html = renderToStaticMarkup(
    createElement(DrugEntityHero, {
      entityType: "DEVICE",
      title: "Apple iPhone 14",
      subtitle: "ข้อมูลอุปกรณ์",
      caseCount: 1,
    })
  );
  assert.match(html, /data-entity-type="DEVICE"/);
  assert.match(html, /Apple iPhone 14/);
  assert.match(html, /ข้อมูลอุปกรณ์/);
  assert.match(html, /border-warning/);
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  assert.match(devicePage, /presentDevicePrimaryIdentity/);
  assert.match(devicePage, /presentIdentifierValue\(data\.device\.imei1/);
  assert.match(devicePage, /di\.entity\.imei1/);
  assert.match(devicePage, /di\.entity\.serialNumber/);
});

test("2. Device recurrence badge and story only when caseCount > 1", () => {
  assert.equal(shouldShowRecurrenceBadge(1), false);
  const html = renderToStaticMarkup(
    createElement(DrugEntityHero, {
      entityType: "DEVICE",
      title: "Apple iPhone 14",
      subtitle: "ข้อมูลอุปกรณ์",
      caseCount: 3,
    })
  );
  assert.match(html, /พบซ้ำข้ามคดี/);
  assert.match(html, /พบข้อมูลนี้รวม 3 คดี/);
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  assert.match(devicePage, /di\.entity\.deviceRepeatedStory/);
  assert.match(devicePage, /shouldShowRecurrenceBadge\(data\.caseCount\)/);
});

test("3. Device related persons use the shared person card family", () => {
  const html = renderToStaticMarkup(
    createElement(DrugRelatedPersonCard, {
      personId: "person-k",
      name: "นายกิตติศักดิ์ ทดสอบระบบ",
      linkedCaseCount: 2,
    })
  );
  assert.match(html, /นายกิตติศักดิ์ ทดสอบระบบ/);
  assert.match(html, /พบเชื่อมโยงใน 2 คดี/);
  assert.match(html, /ดูโปรไฟล์บุคคล/);
  assert.doesNotMatch(html, /เจ้าของอุปกรณ์|อุปกรณ์ของนาย/);
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  assert.match(devicePage, /DrugEntityRelatedPersonList/);
  assert.match(devicePage, /caseCountByPersonId\(data\.caseLinks\)/);
});

test("4. Device related cases use the shared case cards", () => {
  const html = renderToStaticMarkup(
    createElement(DrugEntityRelatedCaseList, {
      currentCaseId: "case-003",
      cases: [{ id: "case-003", caseNumber: "DI-TEST-003", title: "จับกุมเครือข่ายทดสอบ", arrestDate: "2026-08-10T00:00:00.000Z" }],
    })
  );
  assert.match(html, /DI-TEST-003/);
  assert.match(html, /คดีที่กำลังดู/);
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  assert.match(devicePage, /DrugEntityRelatedCaseList/);
  assert.match(devicePage, /di\.entity\.sourceCasesHeading|DrugEntityRelatedCaseList/);
});

test("5. Vehicle identity prefers registration then brand+model", () => {
  assert.equal(
    presentVehiclePrimaryIdentity({
      registrationDisplay: "TEST-9009",
      registrationProvince: "สุราษฎร์ธานี",
      brand: "Honda",
      model: "Civic",
      fallback: "ข้อมูลยานพาหนะ",
    }),
    "TEST-9009 สุราษฎร์ธานี"
  );
  assert.equal(
    presentVehiclePrimaryIdentity({
      registrationDisplay: null,
      registrationProvince: "สุราษฎร์ธานี",
      brand: "Honda",
      model: "Civic",
      fallback: "ข้อมูลยานพาหนะ",
    }),
    "Honda Civic"
  );
  const html = renderToStaticMarkup(
    createElement(DrugEntityHero, {
      entityType: "VEHICLE",
      title: "TEST-9009 สุราษฎร์ธานี",
      subtitle: "ข้อมูลยานพาหนะ",
      caseCount: 1,
    })
  );
  assert.match(html, /data-entity-type="VEHICLE"/);
  assert.match(html, /TEST-9009/);
  assert.match(html, /ข้อมูลยานพาหนะ/);
  assert.match(html, /border-serious/);
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(vehiclePage, /presentVehiclePrimaryIdentity/);
  assert.match(vehiclePage, /di\.entity\.registrationNumber/);
  assert.match(vehiclePage, /di\.vehicle\.type/);
  assert.match(vehiclePage, /di\.entity\.vin/);
});

test("6. Vehicle recurrence badge and story only when caseCount > 1", () => {
  const html = renderToStaticMarkup(
    createElement(DrugEntityHero, {
      entityType: "VEHICLE",
      title: "TEST-9009",
      subtitle: "ข้อมูลยานพาหนะ",
      caseCount: 2,
    })
  );
  assert.match(html, /พบซ้ำข้ามคดี/);
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(vehiclePage, /di\.entity\.vehicleRepeatedStory/);
});

test("7. Vehicle related persons never claim ownership", () => {
  const html = renderToStaticMarkup(
    createElement(DrugRelatedPersonCard, {
      personId: "person-k",
      name: "นายกิตติศักดิ์ ทดสอบระบบ",
    })
  );
  assert.match(html, /พบเกี่ยวข้องกับ/);
  assert.doesNotMatch(html, /เจ้าของรถ|รถของนาย/);
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(vehiclePage, /DrugEntityRelatedPersonList/);
});

test("8. Vehicle related cases use the shared CASE language", () => {
  const html = renderToStaticMarkup(
    createElement(DrugEntityRelatedCaseList, {
      currentCaseId: null,
      cases: [{ id: "case-001", caseNumber: "DI-TEST-001", title: "คดีอื่น", arrestDate: null }],
    })
  );
  assert.match(html, /DI-TEST-001/);
  assert.doesNotMatch(html, /คดีที่กำลังดู/);
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(vehiclePage, /DrugEntityRelatedCaseList/);
});

test("9. Missing optional Device/Vehicle fields render as a dash, never invented", () => {
  assert.equal(
    presentDevicePrimaryIdentity({
      brand: null,
      model: null,
      imei1Display: null,
      serialDisplay: null,
      fallback: "ข้อมูลอุปกรณ์",
    }),
    "ข้อมูลอุปกรณ์"
  );
  assert.equal(
    presentVehiclePrimaryIdentity({
      registrationDisplay: null,
      registrationProvince: null,
      brand: null,
      model: null,
      fallback: "ข้อมูลยานพาหนะ",
    }),
    "ข้อมูลยานพาหนะ"
  );
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(devicePage, /imei1Display \?\? "—"/);
  assert.match(devicePage, /imei2Display \?\? "—"/);
  assert.match(devicePage, /serialDisplay \?\? "—"/);
  assert.match(devicePage, /data\.device\.brand \?\? "—"/);
  assert.match(vehiclePage, /registrationDisplay \?\? "—"/);
  assert.match(vehiclePage, /data\.vehicle\.vehicleType \?\? "—"/);
  assert.match(vehiclePage, /vinDisplay \?\? "—"/);
  assert.doesNotMatch(devicePage, /osVersion|androidId|macAddress/);
  assert.doesNotMatch(vehiclePage, /engineNumber|ownerName/);
});

test("10-12. No ownership, CDR/calling, or risk wording on Device/Vehicle surfaces", () => {
  const dict = read("lib/i18n/dictionary.ts");
  const entityDict = dict.slice(dict.indexOf('"di.entity.phoneTitle"'), dict.indexOf('"di.network.title"'));
  assert.equal(explanationContainsForbiddenEntityClaim(entityDict), false);
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  const layout = read("components/drug_intelligence/drug_entity_detail_layout.tsx");
  for (const src of [devicePage, vehiclePage, layout, entityDict]) {
    assert.doesNotMatch(src, /เจ้าของเบอร์|เจ้าของรถ|เจ้าของอุปกรณ์|โทรหา|สนทนา|CDR|ผู้ต้องสงสัยระดับสูง|ความเสี่ยงสูง|น่าสงสัย|risk score/);
  }
  const notice = renderToStaticMarkup(
    createElement(DrugEntityInfoNotice, null, "ข้อมูลที่แสดงเป็นความเชื่อมโยงจากข้อมูลที่มีอยู่ในระบบ ไม่ได้ยืนยันความเป็นเจ้าของ ความผิด หรือความสัมพันธ์อื่นที่ไม่มีหลักฐานรองรับ")
  );
  assert.match(notice, /หมายเหตุ/);
  assert.match(notice, /ไม่ได้ยืนยันความเป็นเจ้าของ/);
  assert.match(devicePage, /di\.entity\.deviceVehicleSafetyNotice/);
  assert.match(vehiclePage, /di\.entity\.deviceVehicleSafetyNotice/);
});

test("13. Device Network returnTo is preserved", () => {
  const href = drugEntityDetailHref("DEVICE", "dev-1", NETWORK_HREF);
  const back = entityDetailBackHref(new URLSearchParams(href.split("?")[1]));
  assert.equal(back, NETWORK_HREF);
  assert.equal(entityDetailBackLabelKey(back), "di.entity.backToNetwork");
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  assert.match(devicePage, /entityDetailBackHref\(searchParams\)/);
  assert.match(devicePage, /entityDetailBackLabelKey\(inboundReturnTo\)/);
  assert.match(devicePage, /DrugEntityActionBar/);
});

test("14. Vehicle Network returnTo is preserved", () => {
  const href = drugEntityDetailHref("VEHICLE", "veh-1", NETWORK_HREF);
  const back = entityDetailBackHref(new URLSearchParams(href.split("?")[1]));
  assert.equal(back, NETWORK_HREF);
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(vehiclePage, /entityDetailBackHref\(searchParams\)/);
  assert.match(vehiclePage, /entityDetailBackLabelKey\(inboundReturnTo\)/);
});

test("15. Direct Device/Vehicle entry falls back to Search Center", () => {
  assert.equal(entityDetailBackHref(new URLSearchParams()), ENTITY_DETAIL_SEARCH_FALLBACK);
  assert.equal(entityDetailBackLabelKey(getSafeReturnTo(new URLSearchParams())), "di.entity.backToSearch");
});

test("16. Malicious returnTo remains rejected", () => {
  assert.equal(entityDetailBackHref(new URLSearchParams({ returnTo: "https://evil.example" })), ENTITY_DETAIL_SEARCH_FALLBACK);
  assert.equal(entityDetailBackHref(new URLSearchParams({ returnTo: "//evil.example" })), ENTITY_DETAIL_SEARCH_FALLBACK);
  assert.equal(drugEntityDetailHref("DEVICE", "dev-1", "https://evil.example"), drugEntityDetailPath("DEVICE", "dev-1"));
});

test("17-18. Phone/SIM intelligence pages stay on the shared shell", () => {
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.match(phonePage, /entityType="PHONE"/);
  assert.match(simPage, /entityType="SIM"/);
  assert.match(phonePage, /di\.entity\.phoneRepeatedStory/);
  assert.match(simPage, /di\.entity\.simRepeatedStory/);
  assert.match(phonePage, /entityDetailBackHref\(searchParams\)/);
  assert.match(simPage, /entityDetailBackHref\(searchParams\)/);
  assert.equal(DRUG_ENTITY_DETAIL_TONE.PHONE.bar, "border-l-good");
  assert.equal(DRUG_ENTITY_DETAIL_TONE.SIM.bar, "border-l-accent");
  assert.equal(DRUG_ENTITY_DETAIL_TONE.DEVICE.bar, "border-l-warning");
  assert.equal(DRUG_ENTITY_DETAIL_TONE.VEHICLE.bar, "border-l-serious");
});

test("Device/Vehicle keep a single detail hook and omit invented related-intelligence", () => {
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.equal((devicePage.match(/useDrugDeviceDetail\(/g) ?? []).length, 1);
  assert.equal((vehiclePage.match(/useDrugVehicleDetail\(/g) ?? []).length, 1);
  assert.doesNotMatch(devicePage, /useQuery/);
  assert.doesNotMatch(vehiclePage, /useQuery/);
  assert.deepEqual(relatedIntelligenceFromKnownDto(), []);
  assert.doesNotMatch(devicePage, /di\.entity\.relatedOther/);
  assert.doesNotMatch(vehiclePage, /di\.entity\.relatedOther/);
  assert.match(devicePage, /DrugEntityAlertSummary/);
  assert.match(vehiclePage, /grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4/);
  assert.match(devicePage, /break-all|DrugEntityIdentityField/);
});
