/**
 * Unit tests for field-level repairs (Phase 10C): phone, year, whitespace,
 * blank→null, Thai numerals, dedup. Pure — no OpenAI, no I/O.
 *
 * Run with:
 *   npx tsx --test lib/repair/__tests__/field_repair.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  repairOptionalString,
  repairPhone,
  repairRequiredString,
  repairYear,
} from "@/lib/repair/field_repair";

test("phone: reformats a 10-digit number to XXX-XXX-XXXX", () => {
  const r = repairPhone("0815407336");
  assert.equal(r.value, "081-540-7336");
  assert.ok(r.actions.some((a) => a.type === "phone_reformat"));
});

test("phone: converts Thai numerals before reformatting", () => {
  const r = repairPhone("๐๘๑๕๔๐๗๓๓๖");
  assert.equal(r.value, "081-540-7336");
  assert.ok(r.actions.some((a) => a.type === "thai_numeral_to_arabic"));
});

test("phone: de-duplicates a doubled phone number to a single value", () => {
  const r = repairPhone("081-540-7336 081-540-7336");
  assert.equal(r.value, "081-540-7336");
  assert.ok(r.actions.some((a) => a.type === "phone_dedup"));
});

test("phone: blank → null", () => {
  const r = repairPhone("   ");
  assert.equal(r.value, null);
  assert.ok(r.actions.some((a) => a.type === "blank_to_null"));
});

test("phone: a non-standard number is left unchanged, never guessed", () => {
  const r = repairPhone("123");
  assert.equal(r.value, "123");
  assert.ok(!r.actions.some((a) => a.type === "phone_reformat"));
});

test("year: strips a พ.ศ. prefix to the bare numeral", () => {
  const r = repairYear("พ.ศ.2567", "timeline[0].year");
  assert.equal(r.value, "2567");
  assert.ok(r.actions.some((a) => a.type === "year_reformat"));
});

test("year: converts Thai-numeral year to Arabic", () => {
  const r = repairYear("๒๕๖๗", "timeline[0].year");
  assert.equal(r.value, "2567");
  assert.ok(r.actions.some((a) => a.type === "thai_numeral_to_arabic"));
});

test("year: a non-year value (present marker) is left as-is, never fabricated", () => {
  const r = repairYear("ปัจจุบัน", "timeline[0].year");
  assert.equal(r.value, "ปัจจุบัน");
});

test("required string: trims and collapses whitespace but never nulls a blank required field", () => {
  const r = repairRequiredString("  ร.ต.อ.   สมชาย  ", "position");
  assert.equal(r.value, "ร.ต.อ. สมชาย");
  assert.ok(r.actions.some((a) => a.type === "whitespace_trim"));
  assert.ok(r.actions.some((a) => a.type === "collapse_spaces"));

  const blank = repairRequiredString("   ", "rank");
  // Stays an (empty) string so validation can still flag the missing field.
  assert.equal(blank.value, "");
  assert.ok(!blank.actions.some((a) => a.type === "blank_to_null"));
});

test("optional string: blank → null", () => {
  const r = repairOptionalString("   ", "notes");
  assert.equal(r.value, null);
  assert.ok(r.actions.some((a) => a.type === "blank_to_null"));
});

test("optional string: null/undefined pass through as null with no actions", () => {
  assert.deepEqual(repairOptionalString(null, "notes"), { value: null, actions: [] });
  assert.deepEqual(repairOptionalString(undefined, "notes"), { value: null, actions: [] });
});

test("dash variants are normalized to a plain hyphen", () => {
  const r = repairRequiredString("2560 – 2562", "position");
  assert.equal(r.value, "2560 - 2562");
  assert.ok(r.actions.some((a) => a.type === "dash_normalize"));
});
