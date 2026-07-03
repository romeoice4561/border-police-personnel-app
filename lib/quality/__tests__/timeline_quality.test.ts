/**
 * Unit tests for timeline quality analysis (Phase 11B): missing year/unit,
 * empty rows, duplicates, ordering. Read-only; pure.
 *
 * Run with:
 *   npx tsx --test lib/quality/__tests__/timeline_quality.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeTimeline } from "@/lib/quality/timeline_quality";
import type { TimelineEntry } from "@/lib/types/vision";

test("empty timeline scores 0 with zero counts", () => {
  const f = analyzeTimeline([]);
  assert.equal(f.entryCount, 0);
  assert.equal(f.score, 0);
});

test("a clean, ordered timeline scores high", () => {
  const tl: TimelineEntry[] = [
    { year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" },
    { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" },
  ];
  const f = analyzeTimeline(tl);
  assert.equal(f.missingYear, 0);
  assert.equal(f.missingUnit, 0);
  assert.equal(f.emptyRows, 0);
  assert.equal(f.duplicateEntries, 0);
  assert.equal(f.outOfOrder, false);
  assert.ok(f.score >= 90);
});

test("counts missing years", () => {
  const f = analyzeTimeline([
    { year: "", position: "ผบ.ร้อย", unit: "ตชด.447" },
    { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" },
  ]);
  assert.equal(f.missingYear, 1);
});

test("counts missing units (non-fatal, lightly weighted)", () => {
  const f = analyzeTimeline([
    { year: "2564", position: "ผบ.ร้อย", unit: "" },
    { year: "2560", position: "ผบ.มว.", unit: null },
  ]);
  assert.equal(f.missingUnit, 2);
});

test("counts empty rows", () => {
  const f = analyzeTimeline([
    { year: "", position: "", unit: "" },
    { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" },
  ]);
  assert.equal(f.emptyRows, 1);
});

test("counts duplicate entries", () => {
  const dup = { year: "2562", position: "รอง ผกก.", unit: "ตชด.41" };
  const f = analyzeTimeline([dup, dup]);
  assert.equal(f.duplicateEntries, 1);
});

test("detects out-of-order timeline (oldest → newest)", () => {
  const f = analyzeTimeline([
    { year: "2554", position: "a", unit: null },
    { year: "2564", position: "b", unit: null },
  ]);
  assert.equal(f.outOfOrder, true);
});

test("a timeline with only a 'present' entry has no parseable year but is not out-of-order", () => {
  const f = analyzeTimeline([{ year: "ปัจจุบัน", position: "ผบ.ร้อย", unit: "ตชด.447" }]);
  assert.equal(f.outOfOrder, false);
  assert.equal(f.missingYear, 0); // "ปัจจุบัน" is a real value, not blank
});
