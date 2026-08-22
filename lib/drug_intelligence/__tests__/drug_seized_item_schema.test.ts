/**
 * Tests for the Phase DI-3.1 seized-item Zod validation — the COUNT ⇄
 * quantity / MASS ⇄ weightGrams pairing rule, drugCategory/OTHER handling,
 * and rejection of an invalid canonical drugCategory value. Exercised via
 * the full drugCaseCreateSchema (the actual API validation surface) rather
 * than importing the private seizedItemSchema directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { drugCaseCreateSchema } from "@/lib/drug_intelligence/drug_case_api_schemas";

function baseCasePayload(seizedItems: unknown[]) {
  return {
    caseNumber: "TEST-001",
    title: "Test Case",
    persons: [],
    seizedItems,
    locations: [],
    actorId: "actor-1",
    actorName: "Tester",
  };
}

test("a COUNT item with a positive quantity and no weightGrams passes", () => {
  const result = drugCaseCreateSchema.safeParse(
    baseCasePayload([{ drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 20000, unit: "เม็ด" }])
  );
  assert.equal(result.success, true);
});

test("a MASS item with a positive weightGrams and no quantity passes", () => {
  const result = drugCaseCreateSchema.safeParse(
    baseCasePayload([{ drugCategory: "CRYSTAL_METHAMPHETAMINE", measurementKind: "MASS", drugType: "ไอซ์", weightGrams: 2400 }])
  );
  assert.equal(result.success, true);
});

test("a COUNT item missing quantity is rejected", () => {
  const result = drugCaseCreateSchema.safeParse(baseCasePayload([{ drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า" }]));
  assert.equal(result.success, false);
});

test("a COUNT item that ALSO sets weightGrams is rejected (ambiguous combination)", () => {
  const result = drugCaseCreateSchema.safeParse(
    baseCasePayload([{ drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 100, weightGrams: 50 }])
  );
  assert.equal(result.success, false);
});

test("a MASS item missing weightGrams is rejected", () => {
  const result = drugCaseCreateSchema.safeParse(baseCasePayload([{ drugCategory: "HEROIN", measurementKind: "MASS", drugType: "เฮโรอีน" }]));
  assert.equal(result.success, false);
});

test("a MASS item that ALSO sets quantity is rejected (ambiguous combination)", () => {
  const result = drugCaseCreateSchema.safeParse(baseCasePayload([{ drugCategory: "HEROIN", measurementKind: "MASS", drugType: "เฮโรอีน", weightGrams: 100, quantity: 5 }]));
  assert.equal(result.success, false);
});

test("a zero quantity for COUNT is rejected — must be strictly > 0", () => {
  const result = drugCaseCreateSchema.safeParse(baseCasePayload([{ drugCategory: "MDMA", measurementKind: "COUNT", drugType: "ยาอี", quantity: 0, unit: "เม็ด" }]));
  assert.equal(result.success, false);
});

test("drugCategory = OTHER requires otherDrugCategoryLabel", () => {
  const missing = drugCaseCreateSchema.safeParse(baseCasePayload([{ drugCategory: "OTHER", measurementKind: "MASS", drugType: "สารต้องสงสัย", weightGrams: 10 }]));
  assert.equal(missing.success, false);

  const provided = drugCaseCreateSchema.safeParse(
    baseCasePayload([{ drugCategory: "OTHER", otherDrugCategoryLabel: "สารสังเคราะห์ชนิดใหม่", measurementKind: "MASS", drugType: "สารต้องสงสัย", weightGrams: 10 }])
  );
  assert.equal(provided.success, true);
});

test("an invalid/out-of-vocabulary drugCategory value is rejected server-side, regardless of UI dropdown contents", () => {
  const result = drugCaseCreateSchema.safeParse(
    baseCasePayload([{ drugCategory: "NOT_A_REAL_CATEGORY", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 1, unit: "เม็ด" }])
  );
  assert.equal(result.success, false);
});

test("an invalid measurementKind value is rejected", () => {
  const result = drugCaseCreateSchema.safeParse(
    baseCasePayload([{ drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "WEIGHT", drugType: "ยาบ้า", quantity: 1, unit: "เม็ด" }])
  );
  assert.equal(result.success, false);
});

test("multiple seized items in one case, mixing COUNT and MASS rows, all validate independently", () => {
  const result = drugCaseCreateSchema.safeParse(
    baseCasePayload([
      { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 20000, unit: "เม็ด" },
      { drugCategory: "CRYSTAL_METHAMPHETAMINE", measurementKind: "MASS", drugType: "ไอซ์", weightGrams: 2400 },
      { drugCategory: "HEROIN", measurementKind: "MASS", drugType: "เฮโรอีน", weightGrams: 87400 },
    ])
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.seizedItems.length, 3);
});
