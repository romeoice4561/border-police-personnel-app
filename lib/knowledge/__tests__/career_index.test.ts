/**
 * Unit tests for the career-year index and derived career fields (Phase 11A).
 * Pure — built officers via the injected in-memory source.
 *
 * Run with:
 *   npx tsx --test lib/knowledge/__tests__/career_index.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { KnowledgeBuilder, type ExportSource } from "@/lib/knowledge/knowledge_builder";
import { buildCareerYearIndex } from "@/lib/knowledge/career_index";
import type { PersonnelExtraction } from "@/lib/types/vision";

function officerExport(id: string, region: string, file: string, ov: Partial<PersonnelExtraction>) {
  return {
    key: `${region}/${file}`,
    data: {
      region,
      source_file: file,
      normalized_extraction: {
        rank: "ร.ต.ท.",
        first_name: "A",
        last_name: id,
        position: "ผบ.ร้อย",
        unit: "ตชด.447",
        phone: "",
        timeline: [],
        notes: "",
        confidence: 70,
        ...ov,
      } as PersonnelExtraction,
    },
  };
}

function source(exports: ReturnType<typeof officerExport>[]): ExportSource {
  return { read: () => exports };
}

test("indexes officers under every parseable timeline year", () => {
  const base = new KnowledgeBuilder({
    source: source([
      officerExport("o1", "ภาค1", "1.json", {
        timeline: [
          { year: "20 ธ.ค. 64", position: "p", unit: null },
          { year: "1 พ.ค. 54", position: "p", unit: null },
        ],
      }),
    ]),
  }).build();

  const index = buildCareerYearIndex(base.officers);
  assert.equal(index.get(64)?.length, 1);
  assert.equal(index.get(54)?.length, 1);
});

test("two officers active in the same year are grouped together", () => {
  const base = new KnowledgeBuilder({
    source: source([
      officerExport("o1", "ภาค1", "1.json", { timeline: [{ year: "2564", position: "p", unit: null }] }),
      officerExport("o2", "ภาค2", "2.json", { timeline: [{ year: "พ.ศ.2564", position: "p", unit: null }] }),
    ]),
  }).build();

  const index = buildCareerYearIndex(base.officers);
  assert.equal(index.get(2564)?.length, 2);
});

test("derives first_year, last_year, and career_length from the timeline", () => {
  const base = new KnowledgeBuilder({
    source: source([
      officerExport("o1", "ภาค1", "1.json", {
        timeline: [
          { year: "2564", position: "p", unit: null },
          { year: "2554", position: "p", unit: null },
          { year: "2558", position: "p", unit: null },
        ],
      }),
    ]),
  }).build();

  const career = base.officers[0].career;
  assert.equal(career.first_year, 2554);
  assert.equal(career.last_year, 2564);
  assert.equal(career.career_length, 10);
});

test("derives current unit/position from the most-recent timeline entry (present marker wins)", () => {
  const base = new KnowledgeBuilder({
    source: source([
      officerExport("o1", "ภาค1", "1.json", {
        unit: "TOP_UNIT",
        position: "TOP_POSITION",
        timeline: [
          { year: "ปัจจุบัน", position: "CURRENT_POS", unit: "CURRENT_UNIT" },
          { year: "2554", position: "old", unit: "old_unit" },
        ],
      }),
    ]),
  }).build();

  const career = base.officers[0].career;
  assert.equal(career.current_position, "CURRENT_POS");
  assert.equal(career.current_unit, "CURRENT_UNIT");
});

test("timeline with no parseable years yields null year bounds, not a guessed value", () => {
  const base = new KnowledgeBuilder({
    source: source([
      officerExport("o1", "ภาค1", "1.json", { timeline: [{ year: "ปัจจุบัน", position: "p", unit: null }] }),
    ]),
  }).build();

  assert.equal(base.officers[0].career.first_year, null);
  assert.equal(base.officers[0].career.last_year, null);
});

test("timeline_count and unit_count derived fields", () => {
  const base = new KnowledgeBuilder({
    source: source([
      officerExport("o1", "ภาค1", "1.json", {
        unit: "U0",
        timeline: [
          { year: "2564", position: "p", unit: "U1" },
          { year: "2554", position: "p", unit: "U2" },
        ],
      }),
    ]),
  }).build();

  assert.equal(base.officers[0].career.timeline_count, 2);
  // U0 + U1 + U2 distinct.
  assert.equal(base.officers[0].units.length, 3);
});
