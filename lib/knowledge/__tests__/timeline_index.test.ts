/**
 * Unit tests for the timeline-year index and year extraction (Phase 11A).
 * Pure — no OpenAI/OCR/Drive.
 *
 * Run with:
 *   npx tsx --test lib/knowledge/__tests__/timeline_index.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTimelineIndex, extractTimelineYear } from "@/lib/knowledge/timeline_index";
import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import type { TimelineEntry } from "@/lib/types/vision";

test("extractTimelineYear reads a 4-digit Buddhist-era year", () => {
  assert.equal(extractTimelineYear("พ.ศ.2567"), 2567);
  assert.equal(extractTimelineYear("2564"), 2564);
});

test("extractTimelineYear reads the trailing 2-digit year of a Thai date", () => {
  assert.equal(extractTimelineYear("20 ธ.ค. 64"), 64);
  assert.equal(extractTimelineYear("1 พ.ค. 48"), 48);
});

test("extractTimelineYear converts Thai numerals before parsing", () => {
  assert.equal(extractTimelineYear("๒๕๖๗"), 2567);
});

test("extractTimelineYear returns null for a non-year value (never guesses)", () => {
  assert.equal(extractTimelineYear("ปัจจุบัน"), null);
  assert.equal(extractTimelineYear(""), null);
});

function officer(id: string, timeline: TimelineEntry[]): KnowledgeOfficer {
  return {
    identity: { id, rank: "", first_name: "", last_name: "", full_name: "", region: "", source_file: "" },
    career: {
      position: "",
      unit: "",
      phone: "",
      career_length: 0,
      unit_count: 0,
      first_year: null,
      last_year: null,
      current_unit: null,
      current_position: null,
      timeline_count: timeline.length,
    },
    timeline,
    units: [],
    statistics: { career_length: 0, unit_count: 0, timeline_count: timeline.length, first_year: null, last_year: null },
    confidence: 0,
  };
}

test("groups timeline entries by year with their owning officer id", () => {
  const index = buildTimelineIndex([
    officer("o1", [
      { year: "2564", position: "a", unit: null },
      { year: "2554", position: "b", unit: null },
    ]),
    officer("o2", [{ year: "พ.ศ.2564", position: "c", unit: null }]),
  ]);

  const in2564 = index.get(2564);
  assert.equal(in2564?.length, 2);
  assert.deepEqual(in2564?.map((e) => e.officerId).sort(), ["o1", "o2"]);
  assert.equal(index.get(2554)?.length, 1);
});

test("entries with unparseable years are omitted from the index", () => {
  const index = buildTimelineIndex([officer("o1", [{ year: "ปัจจุบัน", position: "a", unit: null }])]);
  assert.equal(index.size, 0);
});
