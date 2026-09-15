/**
 * DI-9.5.2 — Phone + SIM intelligence detail presentation.
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
  DrugEntityRecurrenceBadge,
  DrugEntityRelatedCaseList,
  DrugRelatedPersonCard,
} from "@/components/drug_intelligence/drug_entity_detail_layout";
import {
  caseCountByPersonId,
  explanationContainsForbiddenEntityClaim,
  relatedIntelligenceFromKnownDto,
  resolveEntityDetailCaseContext,
  shouldShowRecurrenceBadge,
} from "@/lib/drug_intelligence/drug_entity_detail_presentation";
import { drugEntityDetailPath, drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("recurrence badge is only for caseCount > 1", () => {
  assert.equal(shouldShowRecurrenceBadge(1), false);
  assert.equal(shouldShowRecurrenceBadge(0), false);
  assert.equal(shouldShowRecurrenceBadge(2), true);
  const hidden = renderToStaticMarkup(createElement(DrugEntityRecurrenceBadge, { caseCount: 1 }));
  const shown = renderToStaticMarkup(createElement(DrugEntityRecurrenceBadge, { caseCount: 3 }));
  assert.equal(hidden, "");
  assert.match(shown, /พบซ้ำข้ามคดี/);
  assert.doesNotMatch(shown, /ความเสี่ยง|risk/i);
});

test("Phone hero shows identity, type label, and recurrence when repeated", () => {
  const html = renderToStaticMarkup(
    createElement(DrugEntityHero, {
      entityType: "PHONE",
      title: "66900001001",
      subtitle: "ข้อมูลเบอร์โทรศัพท์",
      caseCount: 3,
    })
  );
  assert.match(html, /data-entity-type="PHONE"/);
  assert.match(html, /66900001001/);
  assert.match(html, /ข้อมูลเบอร์โทรศัพท์/);
  assert.match(html, /พบซ้ำข้ามคดี/);
  assert.match(html, /พบข้อมูลนี้รวม 3 คดี/);
  assert.match(html, /border-good/);
});

test("SIM hero uses ICCID identity and violet/accent tone", () => {
  const iccid = "89000000000000000001";
  const html = renderToStaticMarkup(
    createElement(DrugEntityHero, {
      entityType: "SIM",
      title: iccid,
      subtitle: "ข้อมูล SIM (ICCID)",
      caseCount: 2,
      copyValue: iccid,
    })
  );
  assert.match(html, /data-entity-type="SIM"/);
  assert.match(html, /89000000000000000001/);
  assert.match(html, /ข้อมูล SIM \(ICCID\)/);
  assert.match(html, /break-all/);
  assert.match(html, /border-accent/);
  assert.match(html, /พบซ้ำข้ามคดี/);
});

test("related-person wording never claims ownership", () => {
  const html = renderToStaticMarkup(
    createElement(DrugRelatedPersonCard, {
      personId: "person-k",
      name: "นายกิตติศักดิ์ ทดสอบระบบ",
      linkedCaseCount: 3,
    })
  );
  assert.match(html, /นายกิตติศักดิ์ ทดสอบระบบ/);
  assert.match(html, /พบเชื่อมโยงใน 3 คดี/);
  assert.match(html, /ดูโปรไฟล์บุคคล/);
  assert.match(html, /\/drug-intelligence\/persons\/person-k/);
  assert.doesNotMatch(html, /เจ้าของเบอร์|เจ้าของ SIM|ผู้ใช้ SIM/);
});

test("case cards render number/title/date; current-context badge only with valid context", () => {
  const withContext = renderToStaticMarkup(
    createElement(DrugEntityRelatedCaseList, {
      currentCaseId: "case-003",
      cases: [
        { id: "case-003", caseNumber: "DI-TEST-003", title: "จับกุมเครือข่ายทดสอบ", arrestDate: "2026-08-10T00:00:00.000Z" },
        { id: "case-001", caseNumber: "DI-TEST-001", title: "คดีอื่น", arrestDate: null },
      ],
    })
  );
  const withoutContext = renderToStaticMarkup(
    createElement(DrugEntityRelatedCaseList, {
      currentCaseId: null,
      cases: [{ id: "case-003", caseNumber: "DI-TEST-003", title: "จับกุมเครือข่ายทดสอบ", arrestDate: null }],
    })
  );
  assert.match(withContext, /DI-TEST-003/);
  assert.match(withContext, /จับกุมเครือข่ายทดสอบ/);
  assert.match(withContext, /คดีที่กำลังดู/);
  assert.equal((withContext.match(/data-current-context="true"/g) ?? []).length, 1);
  assert.doesNotMatch(withoutContext, /คดีที่กำลังดู/);
});

test("current-context resolver requires a loaded source case id", () => {
  assert.equal(resolveEntityDetailCaseContext("case-003", ["case-003", "case-001"]), "case-003");
  assert.equal(resolveEntityDetailCaseContext("case-999", ["case-003"]), null);
  assert.equal(resolveEntityDetailCaseContext(null, ["case-003"]), null);
  assert.equal(resolveEntityDetailCaseContext("../etc", ["case-003"]), null);
});

test("person case counts come from loaded case links only", () => {
  const counts = caseCountByPersonId([
    { personId: "p1", caseId: "c1" },
    { personId: "p1", caseId: "c2" },
    { personId: "p1", caseId: "c1" },
    { personId: "p2", caseId: "c1" },
    { personId: null, caseId: "c3" },
  ]);
  assert.equal(counts.get("p1"), 2);
  assert.equal(counts.get("p2"), 1);
  assert.equal(counts.has("p3"), false);
});

test("related-intelligence section is omitted when the DTO has no extra entities", () => {
  assert.deepEqual(relatedIntelligenceFromKnownDto(), []);
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.doesNotMatch(phonePage, /di\.entity\.relatedOther/);
  assert.doesNotMatch(simPage, /di\.entity\.relatedOther/);
});

test("missing IMSI/network fallback is a dash, long ICCID uses wrapping class", () => {
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.match(simPage, /data\.sim\.imsi \? presentIdentifierValue\(data\.sim\.imsi, canViewFull\) : "—"/);
  assert.match(simPage, /data\.sim\.carrier \?\? "—"/);
  const layout = read("components/drug_intelligence/drug_entity_detail_layout.tsx");
  assert.match(layout, /break-all/);
});

test("masking helpers remain the permission-safe display path", () => {
  assert.equal(presentPhoneNumber("66900001001", false).includes("xxx") || presentPhoneNumber("66900001001", false).includes("x"), true);
  assert.equal(presentPhoneNumber("66900001001", true), "66900001001");
  assert.equal(presentIdentifierValue("89000000000000000001", false).endsWith("0001"), true);
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.match(phonePage, /presentPhoneNumber\(/);
  assert.match(simPage, /presentIdentifierValue\(/);
});

test("entity routes and Network/Timeline actions are preserved", () => {
  assert.equal(drugEntityDetailPath("PHONE", "ph-1"), "/drug-intelligence/phones/ph-1");
  assert.equal(drugEntityDetailPath("SIM", "sim-1"), "/drug-intelligence/sims/sim-1");
  assert.match(drugNetworkFocusPath("PHONE", "ph-1"), /focusType=PHONE/);
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  const layout = read("components/drug_intelligence/drug_entity_detail_layout.tsx");
  assert.match(phonePage, /drugNetworkFocusPath\("PHONE"/);
  assert.match(phonePage, /\/drug-intelligence\/timeline\?phoneNumberId=/);
  assert.match(simPage, /drugNetworkFocusPath\("SIM"/);
  assert.match(simPage, /\/drug-intelligence\/timeline\?simId=/);
  assert.match(layout, /di\.entity\.backToSearch/);
  assert.match(layout, /di\.network\.openNetwork/);
  assert.match(layout, /di\.timeline\.navLabel/);
});

test("no new initial request architecture on Phone/SIM pages", () => {
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.equal((phonePage.match(/useDrugPhoneDetail\(/g) ?? []).length, 1);
  assert.equal((simPage.match(/useDrugSimDetail\(/g) ?? []).length, 1);
  assert.doesNotMatch(phonePage, /useQuery/);
  assert.doesNotMatch(simPage, /useQuery/);
  assert.match(phonePage, /DrugEntityAlertSummary/);
});

test("safety notice and no ownership / CDR / risk wording", () => {
  const notice = renderToStaticMarkup(
    createElement(DrugEntityInfoNotice, null, "ข้อมูลที่แสดงเป็นความเชื่อมโยงจากข้อมูลที่มีอยู่ในระบบ ยังไม่ใช่การยืนยันความเป็นเจ้าของ หรือความสัมพันธ์ทางการสื่อสาร")
  );
  assert.match(notice, /หมายเหตุ/);
  assert.match(notice, /ยังไม่ใช่การยืนยันความเป็นเจ้าของ/);
  const dict = read("lib/i18n/dictionary.ts");
  const entityDict = dict.slice(dict.indexOf('"di.entity.phoneTitle"'), dict.indexOf('"di.network.title"'));
  assert.equal(explanationContainsForbiddenEntityClaim(entityDict), false);
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  const layout = read("components/drug_intelligence/drug_entity_detail_layout.tsx");
  for (const src of [phonePage, simPage, layout, entityDict]) {
    assert.doesNotMatch(src, /เจ้าของเบอร์|โทรหา|สนทนา|CDR|ผู้ต้องสงสัยระดับสูง|ความเสี่ยงสูง|น่าสงสัย/);
  }
});

test("Phone/SIM pages keep a single detail hook and compose reusable layout", () => {
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.match(phonePage, /DrugEntityHero/);
  assert.match(phonePage, /entityType="PHONE"/);
  assert.match(simPage, /entityType="SIM"/);
  assert.match(simPage, /DrugEntityIdentityField/);
  assert.match(phonePage, /di\.entity\.phoneRepeatedStory/);
  assert.match(simPage, /di\.entity\.simRepeatedStory/);
  assert.match(phonePage, /di\.entity\.phoneSimSafetyNotice/);
});
