/**
 * Unit tests for the Phase 7.1 validation engine
 * (validatePersonnelExtraction / PersonnelValidator).
 *
 * Run with: npx tsx --test lib/ai/__tests__/json_validator.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePersonnelExtraction } from "@/lib/ai/json_validator";
import type { PersonnelExtraction, TimelineEntry } from "@/lib/types/vision";

function validRecord(overrides: Partial<PersonnelExtraction> = {}): Partial<PersonnelExtraction> {
  return {
    rank: "Sergeant",
    first_name: "John",
    last_name: "Doe",
    position: "Field Supervisor",
    unit: "Southern Border Division",
    phone: "555-123-4567",
    timeline: [{ year: "2018", position: "Officer", unit: "Southern Border Division" }],
    notes: "Some notes",
    confidence: 90,
    ...overrides,
  };
}

test("fully populated record is valid with no errors or warnings", () => {
  const result = validatePersonnelExtraction(validRecord());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("timeline[].unit missing (omitted) produces a warning, not an error", () => {
  const record = validRecord({
    timeline: [{ year: "2018", position: "Officer" }],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [{ field: "timeline[0].unit", message: "unit is missing" }]);
});

test("timeline[].unit as empty string produces a warning, not an error", () => {
  const record = validRecord({
    timeline: [{ year: "2018", position: "Officer", unit: "" }],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [{ field: "timeline[0].unit", message: "unit is missing" }]);
});

test("timeline[].unit as null produces a warning, not an error", () => {
  const record = validRecord({
    timeline: [{ year: "2018", position: "Officer", unit: null as unknown as string }],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [{ field: "timeline[0].unit", message: "unit is missing" }]);
});

test("multiple timeline entries with missing unit each produce their own indexed warning", () => {
  const record = validRecord({
    timeline: [
      { year: "2018", position: "Officer", unit: "Unit A" },
      { year: "2020", position: "Supervisor", unit: "" },
      { year: "2022", position: "Chief", unit: undefined },
    ],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [
    { field: "timeline[1].unit", message: "unit is missing" },
    { field: "timeline[2].unit", message: "unit is missing" },
  ]);
});

test("phone missing produces a warning, not an error", () => {
  const record = validRecord({ phone: undefined });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => w.field === "phone" && w.message === "phone is missing"));
});

test("phone as empty string produces a warning, not an error", () => {
  const record = validRecord({ phone: "" });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.field === "phone"));
});

test("notes missing produces a warning, not an error", () => {
  const record = validRecord({ notes: undefined });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => w.field === "notes" && w.message === "notes is missing"));
});

test("timeline missing entirely still fails validation (fatal)", () => {
  const record = validRecord({ timeline: undefined });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "timeline"));
});

test("timeline not an array still fails validation (fatal)", () => {
  const record = validRecord({ timeline: "not an array" as unknown as PersonnelExtraction["timeline"] });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "timeline"));
});

test("timeline[].year missing still fails validation (fatal)", () => {
  const record = validRecord({
    timeline: [{ position: "Officer", unit: "Unit A" } as unknown as TimelineEntry],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "timeline[0].year"));
});

test("timeline[].position missing still fails validation (fatal)", () => {
  const record = validRecord({
    timeline: [{ year: "2018", unit: "Unit A" } as unknown as TimelineEntry],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "timeline[0].position"));
});

test("rank/first_name/last_name/position/unit missing still fail validation (fatal)", () => {
  const record = validRecord({
    rank: "",
    first_name: undefined,
    last_name: "",
    position: undefined,
    unit: "",
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("rank"));
  assert.ok(fields.includes("first_name"));
  assert.ok(fields.includes("last_name"));
  assert.ok(fields.includes("position"));
  assert.ok(fields.includes("unit"));
});

test("wrong data type (phone as number) fails validation (fatal)", () => {
  const record = validRecord({ phone: 5551234567 as unknown as string });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "phone"));
});

test("timeline[].unit wrong type (number) fails validation (fatal), unlike missing/empty/null", () => {
  const record = validRecord({
    timeline: [{ year: "2018", position: "Officer", unit: 42 as unknown as string }],
  });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "timeline[0].unit"));
});

test("confidence out of range fails validation (fatal)", () => {
  const record = validRecord({ confidence: 150 });
  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "confidence"));
});

test("real-world example: officer001 timeline with two missing units validates successfully with warnings", () => {
  const record = validRecord({
    rank: "พ.ต.อ.",
    first_name: "อภชาติ",
    last_name: "พุทธบุญ",
    position: "รอง ผบก.ตชด.ภาค ๑",
    unit: "ผบก.ตชด.ภาค ๑",
    phone: "082-754-8244",
    timeline: [
      { year: "ปัจจุบัน", position: "รอง ผบก.ตชด.ภาค ๑", unit: "ผบก.ตชด.ภาค ๑" },
      { year: "พ.ศ.๒๕๖๗", position: "รอง ผบก.ภ.จว.ประจวบคีรีขันธ์", unit: "" },
    ],
    notes: "Timeline รับราชการ",
    confidence: 94,
  });

  const result = validatePersonnelExtraction(record);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [{ field: "timeline[1].unit", message: "unit is missing" }]);
});

test("ValidationResult shape includes valid, errors, and warnings (backward-compatible)", () => {
  const result = validatePersonnelExtraction(validRecord());
  assert.ok("valid" in result);
  assert.ok("errors" in result);
  assert.ok("warnings" in result);
  assert.ok(Array.isArray(result.errors));
  assert.ok(Array.isArray(result.warnings));
});
