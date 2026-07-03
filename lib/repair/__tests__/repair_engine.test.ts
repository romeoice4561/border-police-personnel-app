/**
 * Unit tests for the RepairEngine (Phase 10C): it recovers validation by
 * cleaning the model's own output, re-validates with the EXISTING validator,
 * produces a correct RepairReport, and — critically — NEVER invents missing
 * required facts.
 *
 * Run with:
 *   npx tsx --test lib/repair/__tests__/repair_engine.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DefaultRepairEngine } from "@/lib/repair/repair_engine";
import { PersonnelValidator } from "@/lib/ai/json_validator";
import type { PersonnelExtraction } from "@/lib/types/vision";

const validator = new PersonnelValidator();
const engine = new DefaultRepairEngine();

/** A complete, valid-except-for-the-issue-under-test base record. */
function baseRecord(overrides: Partial<PersonnelExtraction> = {}): PersonnelExtraction {
  return {
    rank: "ร.ต.ท.",
    first_name: "อนิรุทธิ์",
    last_name: "ขาวจันทร์คง",
    position: "ผบ.ร้อย",
    unit: "ตชด.447",
    phone: "0815407336",
    timeline: [],
    notes: "",
    confidence: 80,
    ...overrides,
  };
}

test("recovers a record that failed only on an empty placeholder timeline entry", () => {
  const record = baseRecord({ timeline: [{ year: "", position: "", unit: "" }] });
  const before = validator.validate(record);
  assert.equal(before.valid, false); // fails on empty timeline year+position

  const { repaired, report } = engine.repair(record, before);

  assert.equal(report.beforeValidation.valid, false);
  assert.equal(report.afterValidation.valid, true); // recovered
  assert.deepEqual(repaired.timeline, []); // placeholder removed, nothing invented
  assert.ok(report.repairsApplied.some((a) => a.type === "timeline_remove_empty"));
});

test("reformats phone during repair and reports it", () => {
  const record = baseRecord();
  const before = validator.validate(record);
  const { repaired, report } = engine.repair(record, before);

  assert.equal(repaired.phone, "081-540-7336");
  assert.ok(report.repairsApplied.some((a) => a.type === "phone_reformat"));
});

test("NEVER invents a genuinely missing required field — stays invalid", () => {
  // Missing last_name: repair must not fabricate one; record stays invalid.
  const record = baseRecord({ last_name: "   " });
  const before = validator.validate(record);
  assert.equal(before.valid, false);

  const { repaired, report } = engine.repair(record, before);

  assert.equal(repaired.last_name.trim(), ""); // not fabricated
  assert.equal(report.afterValidation.valid, false); // still correctly invalid
  assert.ok(report.afterValidation.errors.some((e) => e.field === "last_name"));
});

test("a fully clean valid record needs no repairs and stays valid", () => {
  const record = baseRecord({ phone: "081-540-7336" });
  const before = validator.validate(record);
  const { report } = engine.repair(record, before);

  assert.equal(report.beforeValidation.valid, true);
  assert.equal(report.afterValidation.valid, true);
  assert.equal(report.repairsApplied.length, 0);
});

test("does not mutate the input extraction (pure)", () => {
  const record = baseRecord({ phone: "0815407336", timeline: [{ year: "", position: "", unit: "" }] });
  const snapshot = JSON.parse(JSON.stringify(record));
  const before = validator.validate(record);
  engine.repair(record, before);
  assert.deepEqual(record, snapshot);
});

test("carries validation warnings through to the report", () => {
  // Missing phone/notes are warnings (non-fatal); after repair the record is
  // valid but warnings are surfaced.
  const record = baseRecord({ phone: "", notes: "" });
  const before = validator.validate(record);
  const { report } = engine.repair(record, before);

  assert.equal(report.afterValidation.valid, true);
  assert.ok(report.warnings.some((w) => w.startsWith("phone")));
});
