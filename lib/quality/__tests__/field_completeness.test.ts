/**
 * Unit tests for field completeness (Phase 11B): field presence, missing
 * fields, identity completeness, phone quality. Pure — no OpenAI/OCR/Drive.
 *
 * Run with:
 *   npx tsx --test lib/quality/__tests__/field_completeness.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fieldCompletenessScore,
  identityCompletenessScore,
  isFieldPresent,
  missingFields,
  phoneQualityScore,
} from "@/lib/quality/field_completeness";
import type { PersonnelExtraction } from "@/lib/types/vision";

function record(ov: Partial<PersonnelExtraction> = {}): PersonnelExtraction {
  return {
    rank: "ร.ต.ท.",
    first_name: "อนิรุทธิ์",
    last_name: "ขาวจันทร์คง",
    position: "ผบ.ร้อย",
    unit: "ตชด.447",
    phone: "081-540-7336",
    timeline: [{ year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" }],
    notes: "note",
    confidence: 80,
    ...ov,
  };
}

test("a fully complete record has 100% field completeness and no missing fields", () => {
  const r = record();
  assert.equal(fieldCompletenessScore(r), 100);
  assert.deepEqual(missingFields(r), []);
});

test("blank strings count as missing", () => {
  const r = record({ rank: "   ", phone: "" });
  const missing = missingFields(r);
  assert.ok(missing.includes("rank"));
  assert.ok(missing.includes("phone"));
});

test("empty timeline array is treated as missing timeline", () => {
  assert.equal(isFieldPresent(record({ timeline: [] }), "timeline"), false);
  assert.ok(missingFields(record({ timeline: [] })).includes("timeline"));
});

test("confidence present only when a number", () => {
  assert.equal(isFieldPresent(record({ confidence: 0 }), "confidence"), true); // 0 is a valid confidence
  assert.equal(isFieldPresent(record({ confidence: NaN }), "confidence"), false);
});

test("identity completeness reflects the five identity fields", () => {
  assert.equal(identityCompletenessScore(record()), 100);
  assert.equal(identityCompletenessScore(record({ unit: "", position: "" })), 60); // 3 of 5
});

test("phone quality: 100 well-formed, 60 present-but-unformatted, 0 missing", () => {
  assert.equal(phoneQualityScore(record({ phone: "081-540-7336" })), 100);
  assert.equal(phoneQualityScore(record({ phone: "0815407336" })), 60);
  assert.equal(phoneQualityScore(record({ phone: "" })), 0);
});

test("field completeness is proportional (missing 3 of 9 → ~67)", () => {
  const r = record({ phone: "", notes: "", unit: "" });
  assert.equal(fieldCompletenessScore(r), Math.round((6 / 9) * 100));
});
