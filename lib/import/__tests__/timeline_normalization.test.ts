/**
 * Timeline normalization tests (Phase 23B — bugs #3/#5/#6).
 *
 * Covers the required cases: embedded unit, no unit, duplicate position==unit,
 * already-normalized data — plus idempotency and the mid-word safety guard
 * (the "ผกก." vs "กก." trap).
 *
 * Run with:
 *   npx tsx --test lib/import/__tests__/timeline_normalization.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeTimelinePositionUnit } from "@/lib/import/timeline_normalization";

test("embedded unit: splits a boundary-anchored unit out of the position", () => {
  // Unit token "ร้อย ตชด." starts after a space -> clean split.
  const r = normalizeTimelinePositionUnit({ position: "ผบ.มว.ชส. ร้อย ตชด.147", unit: null });
  assert.equal(r.position, "ผบ.มว.ชส.");
  assert.equal(r.unit, "ร้อย ตชด.147");
});

test("embedded unit: splits at 'กก.ตชด.' after a space", () => {
  const r = normalizeTimelinePositionUnit({ position: "ผกก. กก.ตชด.12", unit: null });
  assert.equal(r.position, "ผกก.");
  assert.equal(r.unit, "กก.ตชด.12");
});

test("embedded unit: splits at 'บก.' after a space", () => {
  const r = normalizeTimelinePositionUnit({ position: "รอง ผกก.สส.บก.น.5", unit: null });
  // 'บก.' here is NOT preceded by a space (it's glued to สส.), so it must NOT
  // split mid-string — this row is left as position, unit stays null. This is
  // the conservative-by-design behavior (never invent a boundary).
  assert.equal(r.position, "รอง ผกก.สส.บก.น.5");
  assert.equal(r.unit, null);
});

test("MID-WORD SAFETY: never splits 'ผกก.' into 'ผ' + 'กก.' (the ambiguity trap)", () => {
  const r = normalizeTimelinePositionUnit({ position: "รอง ผกก.ตชด.42", unit: null });
  // "กก." appears inside "ผกก." (no space before it) and "ตชด." is not a unit
  // start token on its own, so nothing splits — position kept whole.
  assert.equal(r.position, "รอง ผกก.ตชด.42");
  assert.equal(r.unit, null);
});

test("no unit: a plain position with no unit token is unchanged", () => {
  const r = normalizeTimelinePositionUnit({ position: "ผบ.ร้อย", unit: null });
  assert.equal(r.position, "ผบ.ร้อย");
  assert.equal(r.unit, null);
});

test("duplicate position==unit: collapses to position, clears unit (#5)", () => {
  const r = normalizeTimelinePositionUnit({ position: "ผกก.ตชด.14", unit: "ผกก.ตชด.14" });
  assert.equal(r.position, "ผกก.ตชด.14");
  assert.equal(r.unit, null);
});

test("already-normalized (both fields set, different): left untouched, never re-split", () => {
  const r = normalizeTimelinePositionUnit({ position: "ผบ.ร้อย", unit: "ร้อย ตชด.447" });
  assert.equal(r.position, "ผบ.ร้อย");
  assert.equal(r.unit, "ร้อย ตชด.447");
});

test("idempotent: normalizing the output again yields the same result", () => {
  const once = normalizeTimelinePositionUnit({ position: "สว.ฝอ.3 บก.อก.บช.ตชด.", unit: null });
  const twice = normalizeTimelinePositionUnit({ position: once.position, unit: once.unit });
  assert.deepEqual(twice, once);
});

test("whitespace is normalized; blank inputs are handled", () => {
  assert.deepEqual(normalizeTimelinePositionUnit({ position: "  ผบ.ร้อย  ", unit: "  " }), { position: "ผบ.ร้อย", unit: null });
  assert.deepEqual(normalizeTimelinePositionUnit({ position: null, unit: null }), { position: "", unit: null });
});

test("a position that IS entirely a unit (boundary at index 0) stays as position, not blanked", () => {
  const r = normalizeTimelinePositionUnit({ position: "กก.ตชด.13", unit: null });
  // boundary === 0 -> no role part -> leave as position rather than emptying it.
  assert.equal(r.position, "กก.ตชด.13");
  assert.equal(r.unit, null);
});
