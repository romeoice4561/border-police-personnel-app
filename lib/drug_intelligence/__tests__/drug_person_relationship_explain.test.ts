/**
 * Person relationship explainability — safe Thai wording + visual chain regressions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertNeverClaimsOwnership,
  assertNeverClaimsUsage,
  buildImportantConnections,
  casePersonRolePhrase,
  explainNetworkRole,
  explainPersonCase,
  explainPersonDevice,
  explainPersonLocation,
  explainPersonPhone,
  explainPersonSim,
  explainPersonVehicle,
  flattenChainLabels,
  personEntityLinkVerb,
  preferHumanCaseLabel,
  relationshipVerbLabel,
} from "@/lib/drug_intelligence/drug_person_relationship_explain";

const ROOT = process.cwd();

test("known relationship verbs stay neutral (เกี่ยวข้องกับ)", () => {
  assert.equal(relationshipVerbLabel("RELATED_TO", "th"), "เกี่ยวข้องกับ");
  assert.equal(personEntityLinkVerb("PHONE", "th"), "เกี่ยวข้องกับ");
  assert.equal(personEntityLinkVerb("SIM", "th"), "เกี่ยวข้องกับ");
  assert.equal(personEntityLinkVerb("DEVICE", "th"), "เกี่ยวข้องกับ");
  assert.equal(personEntityLinkVerb("VEHICLE", "th"), "เกี่ยวข้องกับ");
});

test("generic relationship never upgrades to ownership or usage claims", () => {
  const phone = explainPersonPhone({
    personName: "นายกิตติศักดิ์",
    phoneLabel: "090-000-1001",
    caseLabels: ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"],
    language: "th",
  });
  const blob = [
    phone.headline ?? "",
    ...phone.facts,
    phone.insight ?? "",
    ...phone.path.map((p) => p.verb),
    ...phone.caseChips,
  ].join(" ");
  assert.ok(assertNeverClaimsOwnership(blob));
  assert.ok(assertNeverClaimsUsage(blob));
  assert.match(blob, /เกี่ยวข้องกับ/);
  assert.doesNotMatch(blob, /ใช้เบอร์|เจ้าของ|ครอบครอง/);
});

test("no duplicate primary relationship: path present means headline is null", () => {
  const phone = explainPersonPhone({
    personName: "นายกิตติศักดิ์",
    phoneLabel: "66900001001",
    caseLabels: ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"],
    language: "th",
  });
  assert.equal(phone.headline, null);
  assert.ok(phone.path.length >= 2);
  assert.deepEqual(flattenChainLabels(phone.path), ["นายกิตติศักดิ์", "66900001001", "3 คดี"]);
  assert.deepEqual(phone.caseChips, ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"]);
});

test("Person → Case explanation uses recorded case role as a chain node", () => {
  const model = explainPersonCase({
    personName: "นายกิตติศักดิ์",
    caseLabel: "DI-TEST-003",
    role: "ARRESTED_PERSON",
    language: "th",
  });
  assert.equal(model.headline, null);
  assert.deepEqual(flattenChainLabels(model.path), ["นายกิตติศักดิ์", "ผู้ถูกจับกุม", "DI-TEST-003"]);
  assert.equal(casePersonRolePhrase("SUSPECT", "th"), "ผู้ต้องสงสัย");
  assert.equal(casePersonRolePhrase("UNKNOWN_ROLE", "th"), "ผู้เกี่ยวข้อง");
});

test("Person → Phone explanation lists cases without inventing usage", () => {
  const model = explainPersonPhone({
    personName: "นายกิตติศักดิ์",
    phoneLabel: "66900001001",
    caseLabels: ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"],
    language: "th",
  });
  assert.match(model.path[0]!.verb, /เกี่ยวข้องกับ/);
  assert.equal(model.path[1]!.verb, "พบใน");
  assert.equal(model.caseChips.length, 3);
  assert.match(model.insight ?? "", /3 คดี/);
});

test("Person → SIM path stays case-linked; co-appearance is not ownership", () => {
  const model = explainPersonSim({
    personName: "นายกิตติศักดิ์",
    simLabel: "8900••••0001",
    caseLabels: ["DI-TEST-003"],
    coAppearingPhoneLabels: ["090-000-1001"],
    language: "th",
  });
  assert.equal(model.path.length, 2);
  assert.deepEqual(model.coAppearancePhones, ["090-000-1001"]);
  assert.equal(model.facts.length, 0);
  assert.ok(assertNeverClaimsUsage(model.coAppearancePhones.join(" ")));
  assert.doesNotMatch(model.path.map((p) => p.verb).join(" "), /ใช้กับ|ใช้ซิม/);
});

test("Person → Device / Vehicle explanations prefer related-to", () => {
  const device = explainPersonDevice({
    personName: "นายกิตติศักดิ์",
    deviceLabel: "Apple iPhone 14",
    caseLabels: ["DI-TEST-003"],
    language: "th",
  });
  const vehicle = explainPersonVehicle({
    personName: "นายกิตติศักดิ์",
    vehicleLabel: "TEST-9009",
    caseLabels: ["DI-TEST-001"],
    language: "th",
  });
  assert.equal(device.headline, null);
  assert.equal(vehicle.headline, null);
  assert.equal(device.path[0]!.verb, "เกี่ยวข้องกับ");
  assert.equal(device.path[1]!.verb, "พบผ่าน");
  assert.equal(vehicle.path[1]!.verb, "พบผ่าน");
  assert.equal(device.path[1]?.to.label, "DI-TEST-003");
  assert.equal(vehicle.path[1]?.to.label, "DI-TEST-001");
});

test("Person → Location never claims physical visit", () => {
  const model = explainPersonLocation({
    personName: "นายกิตติศักดิ์",
    locationLabel: "จุดตรวจ A",
    caseLabels: ["DI-TEST-003"],
    locationRole: "ARREST_LOCATION",
    language: "th",
  });
  assert.equal(model.headline, null);
  assert.match(model.path[0]!.verb, /เชื่อมโยงผ่านคดี/);
  assert.match(model.caution ?? "", /ไม่ใช่หลักฐานว่าบุคคลนี้ไปยังสถานที่นี้/);
  assert.equal(model.path[1]!.verb, "สถานที่จับกุม");
});

test("important connections summarize factual multi-case links and verified roles", () => {
  const items = buildImportantConnections({
    language: "th",
    sourceCaseId: null,
    phones: [
      { id: "p1", label: "66900001001", caseCount: 3, caseIds: ["c1", "c2", "c3"] },
      { id: "p2", label: "66900001005", caseCount: 1, caseIds: ["c1"] },
    ],
    devices: [{ id: "d1", label: "Apple iPhone 14", caseCount: 1, caseIds: ["c1"] }],
    vehicles: [{ id: "v1", label: "TEST-9009", caseCount: 1, caseIds: ["c1"] }],
    networkRoles: [
      { id: "r1", role: "COORDINATOR", verificationStatus: "CONFIRMED" },
      { id: "r2", role: "SUPPLIER", verificationStatus: "UNVERIFIED" },
    ],
  });
  assert.ok(items.some((i) => i.primaryLabel === "66900001001" && i.detail.includes("3")));
  assert.ok(items.some((i) => i.kind === "NETWORK_ROLE" && i.detail.includes("ยืนยัน")));
  assert.ok(!items.some((i) => i.id === "role:r2"));
});

test("verified/unverified network role explanations expose why", () => {
  const unverified = explainNetworkRole({
    role: "SUPPLIER",
    source: "TESTIMONY",
    verificationStatus: "UNVERIFIED",
    sourceCaseLabel: "DI-TEST-001",
    recordedByName: "Administrator",
    recordedAtLabel: "13 ก.ย. 2569",
    note: "DEMO long text",
    language: "th",
  });
  assert.match(unverified.headline ?? "", /ยังไม่ยืนยัน/);
  assert.match(unverified.caution ?? "", /ยังไม่มีหลักฐานอื่นยืนยัน/);
  assert.ok(unverified.facts.some((f) => f.includes("DI-TEST-001")));
  assert.ok(!unverified.facts.some((f) => f.includes("DEMO")));

  const confirmed = explainNetworkRole({
    role: "COORDINATOR",
    source: "DIRECT_ARREST",
    verificationStatus: "CONFIRMED",
    sourceCaseLabel: "DI-TEST-003",
    recordedByName: "Administrator",
    recordedAtLabel: "13 ก.ย. 2569",
    note: null,
    language: "th",
  });
  assert.match(confirmed.headline ?? "", /ยืนยันจากคดี/);
  assert.equal(confirmed.caution, null);
});

test("human-readable IDs preferred over raw UUID narrative", () => {
  assert.equal(preferHumanCaseLabel("DI-TEST-003", "04d2ac30-976a-460d-b77d-31e74153e59f"), "DI-TEST-003");
  assert.match(preferHumanCaseLabel(null, "04d2ac30-976a-460d-b77d-31e74153e59f"), /04d2ac30…e59f/);
});

test("Person page wires relationship explanation + scroll tabs + case counts", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(page, /RelationshipExplanation/);
  assert.match(page, /ImportantConnections/);
  assert.match(page, /flex-nowrap/);
  assert.match(page, /overflow-x-auto rounded-xl border border-border bg-surface p-1\.5/);
  assert.match(page, /case-linked-counts/);
  assert.doesNotMatch(page, /role="tablist"[\s\S]*?flex-wrap gap-1 overflow-x-auto/);
});

test("visual chain UI avoids duplicate headline when path exists", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_relationship_explanation.tsx"), "utf8");
  assert.match(src, /data-testid="relationship-path"/);
  assert.match(src, /data-testid="relationship-node"/);
  assert.match(src, /important-connections-grid/);
  assert.match(src, /hasPath \? <RelationshipPath/);
  assert.match(src, /!hasPath && model\.headline/);
});
