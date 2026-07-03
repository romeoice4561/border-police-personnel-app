/**
 * Unit tests for timeline repairs (Phase 10C): remove empty placeholder
 * entries, dedup, reorder newest→oldest, per-entry field repair — and the
 * critical guarantee that repair NEVER fabricates a missing year/position/unit.
 *
 * Run with:
 *   npx tsx --test lib/repair/__tests__/timeline_repair.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { repairTimeline } from "@/lib/repair/timeline_repair";
import type { TimelineEntry } from "@/lib/types/vision";

test("removes an all-empty placeholder entry, yielding an empty timeline", () => {
  const r = repairTimeline([{ year: "", position: "", unit: "" }]);
  assert.deepEqual(r.value, []);
  assert.ok(r.actions.some((a) => a.type === "timeline_remove_empty"));
});

test("keeps a partially-filled real entry (blank year but real position) — does not delete it", () => {
  const input: TimelineEntry[] = [{ year: "", position: "ผบ.ร้อย", unit: "ตชด.447" }];
  const r = repairTimeline(input);
  assert.equal(r.value.length, 1);
  assert.equal(r.value[0].position, "ผบ.ร้อย");
  // The blank year is NOT invented.
  assert.equal(r.value[0].year, "");
});

test("removes exact-duplicate entries", () => {
  const dup: TimelineEntry[] = [
    { year: "2562", position: "ผบ.ร้อย", unit: "ตชด.447" },
    { year: "2562", position: "ผบ.ร้อย", unit: "ตชด.447" },
  ];
  const r = repairTimeline(dup);
  assert.equal(r.value.length, 1);
  assert.ok(r.actions.some((a) => a.type === "timeline_dedup"));
});

test("reorders entries newest → oldest", () => {
  const r = repairTimeline([
    { year: "2558", position: "a", unit: null },
    { year: "2564", position: "b", unit: null },
    { year: "2560", position: "c", unit: null },
  ]);
  assert.deepEqual(
    r.value.map((e) => e.year),
    ["2564", "2560", "2558"]
  );
  assert.ok(r.actions.some((a) => a.type === "timeline_reorder"));
});

test("converts Thai-numeral years within entries", () => {
  const r = repairTimeline([{ year: "๒๕๖๔", position: "ก", unit: null }]);
  assert.equal(r.value[0].year, "2564");
  assert.ok(r.actions.some((a) => a.type === "thai_numeral_to_arabic"));
});

test("strips พ.ศ. prefixes within entries", () => {
  const r = repairTimeline([{ year: "พ.ศ.2567", position: "ก", unit: null }]);
  assert.equal(r.value[0].year, "2567");
});

test("never invents a unit for an entry that has none", () => {
  const r = repairTimeline([{ year: "2560", position: "ผบ.มว.", unit: null }]);
  assert.equal(r.value.length, 1);
  assert.equal(r.value[0].unit ?? null, null); // stays missing, not fabricated
});

test("an already-clean single entry produces no reorder/dedup/remove actions", () => {
  const r = repairTimeline([{ year: "2562", position: "ผบ.ร้อย", unit: "ตชด.447" }]);
  assert.equal(r.value.length, 1);
  assert.ok(!r.actions.some((a) => a.type === "timeline_reorder"));
  assert.ok(!r.actions.some((a) => a.type === "timeline_remove_empty"));
  assert.ok(!r.actions.some((a) => a.type === "timeline_dedup"));
});
