/**
 * Unit tests for knowledge statistics + duplicate detection (Phase 11A):
 * summary aggregates, highest/lowest rank, and detection-only duplicates
 * (phone/officer/timeline/unit). Pure — no OpenAI/OCR/Drive.
 *
 * Run with:
 *   npx tsx --test lib/knowledge/__tests__/knowledge_statistics.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { KnowledgeBuilder, type ExportSource, type RawExport } from "@/lib/knowledge/knowledge_builder";
import { buildKnowledgeSummary, detectDuplicates } from "@/lib/knowledge/knowledge_statistics";
import type { PersonnelExtraction } from "@/lib/types/vision";

function exp(region: string, file: string, ov: Partial<PersonnelExtraction>): RawExport {
  return {
    key: `${region}/${file}`,
    data: {
      region,
      source_file: file,
      normalized_extraction: {
        rank: "ร.ต.ท.",
        first_name: "A",
        last_name: "B",
        position: "ผบ.ร้อย",
        unit: "ตชด.447",
        phone: "081-000-0001",
        timeline: [{ year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" }],
        notes: "",
        confidence: 70,
        ...ov,
      } as PersonnelExtraction,
    },
  };
}

function build(exports: RawExport[]) {
  const source: ExportSource = { read: () => exports };
  return new KnowledgeBuilder({ source }).build();
}

test("summary counts officers, units, phones, and timeline entries", () => {
  const base = build([
    exp("ภาค1", "1.json", { phone: "081-000-0001", unit: "U1" }),
    exp("ภาค2", "2.json", { phone: "081-000-0002", unit: "U2" }),
  ]);
  const summary = buildKnowledgeSummary(base);

  assert.equal(summary.total_officers, 2);
  assert.equal(summary.total_phone_numbers, 2);
  assert.ok(summary.total_units >= 2);
  assert.equal(summary.total_timeline_entries, 2);
});

test("empty knowledge base yields zeroed summary with null ranks", () => {
  const summary = buildKnowledgeSummary(build([]));
  assert.equal(summary.total_officers, 0);
  assert.equal(summary.average_career_years, 0);
  assert.equal(summary.highest_rank, null);
  assert.equal(summary.lowest_rank, null);
});

test("highest and lowest rank chosen by seniority", () => {
  const base = build([
    exp("ภาค1", "1.json", { rank: "พ.ต.อ.", phone: "081-000-0001" }),
    exp("ภาค2", "2.json", { rank: "ส.ต.ต.", phone: "081-000-0002" }),
    exp("ภาค3", "3.json", { rank: "ร.ต.ท.", phone: "081-000-0003" }),
  ]);
  const summary = buildKnowledgeSummary(base);
  assert.equal(summary.highest_rank, "พ.ต.อ."); // most senior
  assert.equal(summary.lowest_rank, "ส.ต.ต."); // most junior
});

test("detects duplicate phones (detection only, data unchanged)", () => {
  const exports = [
    exp("ภาค1", "1.json", { phone: "081-111-1111", last_name: "X" }),
    exp("ภาค2", "2.json", { phone: "081-111-1111", last_name: "Y" }),
  ];
  const base = build(exports);
  const dup = detectDuplicates(base);

  assert.equal(dup.duplicate_phones.length, 1);
  assert.equal(dup.duplicate_phones[0].key, "081-111-1111");
  assert.deepEqual(dup.duplicate_phones[0].officerIds.sort(), ["ภาค1/1", "ภาค2/2"]);
  // Data is not modified: both officers still present with their phone.
  assert.equal(base.officers.length, 2);
  assert.equal(base.officers[0].career.phone, "081-111-1111");
});

test("detects duplicate officers by rank + full name", () => {
  const base = build([
    exp("ภาค1", "1.json", { rank: "ร.ต.ท.", first_name: "สมชาย", last_name: "ใจดี", phone: "081-000-0001" }),
    exp("ภาค2", "2.json", { rank: "ร.ต.ท.", first_name: "สมชาย", last_name: "ใจดี", phone: "081-000-0002" }),
  ]);
  const dup = detectDuplicates(base);
  assert.equal(dup.duplicate_officers.length, 1);
});

test("detects duplicate timeline entries shared across officers", () => {
  const shared = { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" };
  const base = build([
    exp("ภาค1", "1.json", { phone: "081-000-0001", timeline: [shared] }),
    exp("ภาค2", "2.json", { phone: "081-000-0002", timeline: [shared] }),
  ]);
  const dup = detectDuplicates(base);
  assert.equal(dup.duplicate_timeline.length, 1);
  assert.deepEqual(dup.duplicate_timeline[0].officerIds.sort(), ["ภาค1/1", "ภาค2/2"]);
});

test("detects duplicate units (a unit served by more than one officer)", () => {
  const base = build([
    exp("ภาค1", "1.json", { unit: "ตชด.447", phone: "081-000-0001" }),
    exp("ภาค2", "2.json", { unit: "ตชด.447", phone: "081-000-0002" }),
  ]);
  const dup = detectDuplicates(base);
  assert.ok(dup.duplicate_units.some((g) => g.key === "ตชด.447"));
});

test("no false-positive duplicates when phones/names differ", () => {
  const base = build([
    exp("ภาค1", "1.json", { phone: "081-000-0001", first_name: "A", last_name: "1" }),
    exp("ภาค2", "2.json", { phone: "081-000-0002", first_name: "B", last_name: "2", unit: "OTHER" }),
  ]);
  const dup = detectDuplicates(base);
  assert.equal(dup.duplicate_phones.length, 0);
  assert.equal(dup.duplicate_officers.length, 0);
});
