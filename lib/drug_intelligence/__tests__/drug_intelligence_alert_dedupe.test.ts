/**
 * Tests for the DI-6 alert deduplication key — one meaningful event must
 * always compute the SAME key, so repeated generation upserts the existing
 * row rather than inserting a duplicate.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrugAlertDedupeKey, orderDrugDuplicatePair } from "@/lib/drug_intelligence/drug_intelligence_alert_dedupe";

test("same inputs always produce the same dedupe key (deterministic)", () => {
  const a = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: "case1" });
  const b = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: "case1" });
  assert.equal(a, b);
});

test("REPEAT_PHONE key includes currentCaseId — the same phone reused in a DIFFERENT new case is a distinct event", () => {
  const a = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: "case1" });
  const b = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: "case2" });
  assert.notEqual(a, b);
});

test("REPEAT_PERSON key excludes currentCaseId — it's a property of the person, not tied to any one case", () => {
  const a = computeDrugAlertDedupeKey({ alertType: "REPEAT_PERSON", entityType: "PERSON", entityId: "person1", currentCaseId: "case1" });
  const b = computeDrugAlertDedupeKey({ alertType: "REPEAT_PERSON", entityType: "PERSON", entityId: "person1", currentCaseId: "case2" });
  assert.equal(a, b);
});

test("different entityId always produces a different key", () => {
  const a = computeDrugAlertDedupeKey({ alertType: "REPEAT_DEVICE", entityType: "DEVICE", entityId: "d1", currentCaseId: "case1" });
  const b = computeDrugAlertDedupeKey({ alertType: "REPEAT_DEVICE", entityType: "DEVICE", entityId: "d2", currentCaseId: "case1" });
  assert.notEqual(a, b);
});

test("different alertType always produces a different key even for the same entity", () => {
  const a = computeDrugAlertDedupeKey({ alertType: "REPEAT_DEVICE", entityType: "DEVICE", entityId: "d1", currentCaseId: "case1" });
  const b = computeDrugAlertDedupeKey({ alertType: "REPEAT_CASE_ENTITY", entityType: "DEVICE", entityId: "d1", currentCaseId: "case1" });
  assert.notEqual(a, b);
});

test("null currentCaseId can never collide with any real case id string, including edge-case-looking ones", () => {
  const a = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: null });
  const b = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: "none" });
  const c = computeDrugAlertDedupeKey({ alertType: "REPEAT_PHONE", entityType: "PHONE", entityId: "p1", currentCaseId: "nocase" });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("orderDrugDuplicatePair: the same pair in either argument order produces the same ordered result", () => {
  assert.deepEqual(orderDrugDuplicatePair("personA", "personB"), orderDrugDuplicatePair("personB", "personA"));
});

test("orderDrugDuplicatePair: lexicographically smaller id always comes first", () => {
  const [first, second] = orderDrugDuplicatePair("zzz", "aaa");
  assert.equal(first, "aaa");
  assert.equal(second, "zzz");
});
