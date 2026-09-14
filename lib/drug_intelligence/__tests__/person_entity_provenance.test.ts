import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aggregateLinksByEntity,
  buildPersonIntelligenceFacts,
  countEntitiesInCase,
  entityAppearsInMultipleCases,
  presentDrawerPhones,
  splitRelatedByCurrentCase,
  uniquePreserveOrder,
} from "@/lib/drug_intelligence/person_entity_provenance";

test("aggregateLinksByEntity dedupes the same phone in the same case and keeps distinct numbers", () => {
  const caseById = new Map([
    ["case-a", { caseNumber: "DI-A", arrestDate: new Date("2026-08-01") }],
    ["case-b", { caseNumber: "DI-B", arrestDate: new Date("2026-08-05") }],
    ["case-c", { caseNumber: "DI-C", arrestDate: new Date("2026-08-10") }],
  ]);
  const entities = aggregateLinksByEntity(
    [
      { caseId: "case-a", phoneNumberId: "p1", firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01") },
      { caseId: "case-a", phoneNumberId: "p1", firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-02") },
      { caseId: "case-a", phoneNumberId: "p2", firstSeenAt: null, lastSeenAt: null },
      { caseId: "case-b", phoneNumberId: "p3", firstSeenAt: new Date("2026-08-05"), lastSeenAt: new Date("2026-08-05") },
      { caseId: "case-b", phoneNumberId: "p1", firstSeenAt: new Date("2026-08-05"), lastSeenAt: new Date("2026-08-05") },
      { caseId: "case-c", phoneNumberId: "p4", firstSeenAt: new Date("2026-08-10"), lastSeenAt: new Date("2026-08-10") },
    ],
    (row) => row.phoneNumberId,
    (row) => ({ firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt }),
    caseById,
  );

  assert.equal(entities.length, 4);
  const p1 = entities.find((row) => row.entityId === "p1");
  assert.ok(p1);
  assert.equal(p1.cases.length, 2);
  assert.equal(countEntitiesInCase(entities, "case-a"), 2);
  assert.equal(entityAppearsInMultipleCases(p1), true);
  assert.equal(p1.lastSeenAt?.toISOString().slice(0, 10), "2026-08-05");
});

test("splitRelatedByCurrentCase keeps current-case entities out of the other-cases list", () => {
  const entities = [
    { id: "in-both", cases: [{ caseId: "case-a" }, { caseId: "case-b" }] },
    { id: "other-only", cases: [{ caseId: "case-c" }] },
    { id: "unscoped", cases: [] },
  ];
  const split = splitRelatedByCurrentCase(entities, "case-a");
  assert.deepEqual(split.inCurrentCase.map((row) => row.id), ["in-both"]);
  assert.deepEqual(split.inOtherCases.map((row) => row.id), ["other-only"]);
  assert.deepEqual(split.withoutCaseProvenance.map((row) => row.id), ["unscoped"]);
  assert.equal(uniquePreserveOrder(["a", "a", "b"]).join(","), "a,b");
});

test("P002-shaped split: current case has one phone; aggregate has two; TEL005 is other-case only", () => {
  const tel001 = {
    phoneNumberId: "tel001",
    cases: [{ caseId: "di-001" }, { caseId: "di-002" }, { caseId: "di-003" }],
  };
  const tel005 = {
    phoneNumberId: "tel005",
    cases: [{ caseId: "di-003" }],
  };
  const split = splitRelatedByCurrentCase([tel001, tel005], "di-001");
  assert.equal(countEntitiesInCase([tel001, tel005], "di-001"), 1);
  assert.equal([tel001, tel005].length, 2);
  assert.deepEqual(split.inCurrentCase.map((row) => row.phoneNumberId), ["tel001"]);
  assert.deepEqual(split.inOtherCases.map((row) => row.phoneNumberId), ["tel005"]);
  assert.equal(entityAppearsInMultipleCases(tel001), true);
  assert.equal(tel001.cases.length, 3);
});

test("presentDrawerPhones collapses three TEL001 junction rows into one row with case count 3", () => {
  const rows = [
    { phoneNumberId: "tel001", caseId: "di-001", phoneNumber: { normalizedNumber: "66900001001" } },
    { phoneNumberId: "tel001", caseId: "di-002", phoneNumber: { normalizedNumber: "66900001001" } },
    { phoneNumberId: "tel001", caseId: "di-003", phoneNumber: { normalizedNumber: "66900001001" } },
    { phoneNumberId: "tel005", caseId: "di-003", phoneNumber: { normalizedNumber: "66900001005" } },
  ];
  const presented = presentDrawerPhones(rows, "di-001");
  assert.equal(presented.length, 2);
  const tel001 = presented.find((row) => row.phoneNumberId === "tel001");
  const tel005 = presented.find((row) => row.phoneNumberId === "tel005");
  assert.ok(tel001);
  assert.ok(tel005);
  assert.equal(tel001.uniqueCaseCount, 3);
  assert.equal(tel001.inCurrentCase, true);
  assert.equal(tel005.uniqueCaseCount, 1);
  assert.equal(tel005.inCurrentCase, false);
});

test("buildPersonIntelligenceFacts is deterministic provenance, not a risk score", () => {
  const facts = buildPersonIntelligenceFacts({
    caseCount: 3,
    currentCaseId: "di-001",
    phones: [
      { phoneNumberId: "tel001", cases: [{ caseId: "di-001" }, { caseId: "di-002" }, { caseId: "di-003" }] },
      { phoneNumberId: "tel005", cases: [{ caseId: "di-003" }] },
    ],
    sims: [{ simId: "sim001", cases: [{ caseId: "di-003" }] }],
    devices: [{ deviceId: "dev001", cases: [{ caseId: "di-003" }] }],
    vehicles: [{ vehicleId: "veh003", cases: [{ caseId: "di-003" }] }],
  });
  assert.deepEqual(
    facts.map((fact) => fact.kind),
    ["PERSON_IN_N_CASES", "PHONE_MULTI_CASE", "ADDITIONAL_PHONES", "ADDITIONAL_SIMS", "ADDITIONAL_DEVICES", "ADDITIONAL_VEHICLES"],
  );
  const extraPhone = facts.find((fact) => fact.kind === "ADDITIONAL_PHONES");
  assert.equal(extraPhone && extraPhone.kind === "ADDITIONAL_PHONES" ? extraPhone.count : 0, 1);
  const multi = facts.find((fact) => fact.kind === "PHONE_MULTI_CASE");
  assert.equal(multi && multi.kind === "PHONE_MULTI_CASE" ? multi.caseCount : 0, 3);
  const aggregateFacts = buildPersonIntelligenceFacts({
    caseCount: 3,
    currentCaseId: null,
    phones: [{ phoneNumberId: "tel001", cases: [{ caseId: "di-001" }, { caseId: "di-002" }, { caseId: "di-003" }] }],
    sims: [],
    devices: [],
    vehicles: [],
  });
  assert.equal(aggregateFacts.some((fact) => fact.kind.startsWith("ADDITIONAL_")), false);
});
