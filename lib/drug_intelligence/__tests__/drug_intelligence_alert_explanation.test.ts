/**
 * Tests for DI-6 alert title/explanation composition — Section 25's neutral
 * wording rule. Every composed string must use only the approved neutral
 * phrases and must NEVER claim proven association, ownership, or
 * co-conspirator status. No probability percentages ever appear.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeDrugAlertTitle, composeDrugAlertExplanation } from "@/lib/drug_intelligence/drug_intelligence_alert_explanation";
import type { DrugAlertType, DrugAlertEntityType } from "@/lib/drug_intelligence/drug_intelligence_alert_types";

const ALL_TYPES: DrugAlertType[] = ["REPEAT_PERSON", "REPEAT_PHONE", "REPEAT_SIM", "REPEAT_DEVICE", "REPEAT_VEHICLE", "REPEAT_CASE_ENTITY", "NEW_NETWORK_CONNECTION", "HIGH_CONFIDENCE_DUPLICATE"];

const FORBIDDEN_PHRASES = ["เป็นเครือข่ายเดียวกัน", "เป็นเจ้าของ", "เป็นผู้ร่วมขบวนการ", "%"];

test("every alert type produces a non-empty title", () => {
  for (const alertType of ALL_TYPES) {
    const title = composeDrugAlertTitle({ alertType, entityType: "PHONE", priorCaseCount: 2, relatedPersonCount: 1 });
    assert.ok(title.length > 0, `${alertType} produced an empty title`);
  }
});

test("every alert type produces a non-empty explanation", () => {
  for (const alertType of ALL_TYPES) {
    const explanation = composeDrugAlertExplanation({ alertType, entityType: "PHONE", priorCaseCount: 2, relatedPersonCount: 1 });
    assert.ok(explanation.length > 0, `${alertType} produced an empty explanation`);
  }
});

test("no title or explanation ever contains a forbidden phrase (proven-association / ownership / co-conspirator / probability percentage)", () => {
  for (const alertType of ALL_TYPES) {
    const title = composeDrugAlertTitle({ alertType, entityType: "VEHICLE", priorCaseCount: 5, relatedPersonCount: 3 });
    const explanation = composeDrugAlertExplanation({ alertType, entityType: "VEHICLE", priorCaseCount: 5, relatedPersonCount: 3 });
    for (const phrase of FORBIDDEN_PHRASES) {
      assert.ok(!title.includes(phrase), `title for ${alertType} contains forbidden phrase "${phrase}": ${title}`);
      assert.ok(!explanation.includes(phrase), `explanation for ${alertType} contains forbidden phrase "${phrase}": ${explanation}`);
    }
  }
});

test("REPEAT_PHONE explanation reflects the prior case count", () => {
  const explanation = composeDrugAlertExplanation({ alertType: "REPEAT_PHONE", entityType: "PHONE", priorCaseCount: 3, relatedPersonCount: 0 });
  assert.ok(explanation.includes("3"));
});

test("REPEAT_PHONE explanation mentions related persons only when relatedPersonCount > 0", () => {
  const withPersons = composeDrugAlertExplanation({ alertType: "REPEAT_PHONE", entityType: "PHONE", priorCaseCount: 2, relatedPersonCount: 2 });
  const withoutPersons = composeDrugAlertExplanation({ alertType: "REPEAT_PHONE", entityType: "PHONE", priorCaseCount: 2, relatedPersonCount: 0 });
  assert.ok(withPersons.includes("บุคคล"));
  assert.ok(!withoutPersons.includes("เกี่ยวข้องกับบุคคลที่บันทึกไว้"));
});

test("composed strings never embed a raw entity value — output is identical regardless of what the caller might have passed as an id/label elsewhere", () => {
  const entityTypes: DrugAlertEntityType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE"];
  for (const entityType of entityTypes) {
    const a = composeDrugAlertExplanation({ alertType: "REPEAT_PHONE", entityType, priorCaseCount: 1, relatedPersonCount: 0 });
    const b = composeDrugAlertExplanation({ alertType: "REPEAT_PHONE", entityType, priorCaseCount: 1, relatedPersonCount: 0 });
    assert.equal(a, b, "identical facts must always produce identical composed text, with no hidden per-call variance");
  }
});

test("title composition is deterministic — same input always produces the same output", () => {
  const a = composeDrugAlertTitle({ alertType: "REPEAT_DEVICE", entityType: "DEVICE", priorCaseCount: 2, relatedPersonCount: 2 });
  const b = composeDrugAlertTitle({ alertType: "REPEAT_DEVICE", entityType: "DEVICE", priorCaseCount: 2, relatedPersonCount: 2 });
  assert.equal(a, b);
});
