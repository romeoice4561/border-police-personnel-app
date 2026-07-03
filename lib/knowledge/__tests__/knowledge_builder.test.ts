/**
 * Unit tests for KnowledgeBuilder (Phase 11A): reads exports via an injected
 * in-memory source (no filesystem), maps to officers, derives fields, and
 * handles empty/partial/malformed exports. Pure — no OpenAI/OCR/Drive.
 *
 * Run with:
 *   npx tsx --test lib/knowledge/__tests__/knowledge_builder.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { KnowledgeBuilder, type ExportSource, type RawExport } from "@/lib/knowledge/knowledge_builder";
import type { ExportedOfficerFile } from "@/lib/knowledge/knowledge_types";
import type { PersonnelExtraction } from "@/lib/types/vision";

function extraction(overrides: Partial<PersonnelExtraction> = {}): PersonnelExtraction {
  return {
    rank: "ร.ต.ท.",
    first_name: "อนิรุทธิ์",
    last_name: "ขาวจันทร์คง",
    position: "ผบ.ร้อย",
    unit: "ตชด.447",
    phone: "081-540-7336",
    timeline: [
      { year: "20 ธ.ค. 64", position: "ผบ.ร้อย", unit: "ตชด.447" },
      { year: "1 พ.ค. 54", position: "ผบ.หมู่", unit: "สภ.นาวัง" },
    ],
    notes: "",
    confidence: 80,
    ...overrides,
  };
}

function source(exports: RawExport[]): ExportSource {
  return { read: () => exports };
}

test("builds one officer per export file", () => {
  const builder = new KnowledgeBuilder({
    source: source([
      { key: "ภาค1/5.json", data: { region: "ภาค1", source_file: "5.jpg", normalized_extraction: extraction() } },
      { key: "ภาค2/7.json", data: { region: "ภาค2", source_file: "7.jpg", normalized_extraction: extraction({ first_name: "สมชาย" }) } },
    ]),
  });

  const base = builder.build();
  assert.equal(base.officers.length, 2);
});

test("derives a deterministic officer id from region + source file", () => {
  const builder = new KnowledgeBuilder({
    source: source([{ key: "ภาค1/5.json", data: { region: "ภาค1", source_file: "5.jpg", normalized_extraction: extraction() } }]),
  });
  const base = builder.build();
  assert.equal(base.officers[0].identity.id, "ภาค1/5");
});

test("prefers normalized_extraction over original_extraction", () => {
  const file: ExportedOfficerFile = {
    region: "ภาค1",
    source_file: "1.jpg",
    original_extraction: extraction({ rank: "ORIGINAL" }),
    normalized_extraction: extraction({ rank: "NORMALIZED" }),
  };
  const base = new KnowledgeBuilder({ source: source([{ key: "ภาค1/1.json", data: file }]) }).build();
  assert.equal(base.officers[0].identity.rank, "NORMALIZED");
});

test("falls back to original_extraction when normalized is absent", () => {
  const file: ExportedOfficerFile = { region: "ภาค1", source_file: "1.jpg", original_extraction: extraction({ rank: "FALLBACK" }) };
  const base = new KnowledgeBuilder({ source: source([{ key: "ภาค1/1.json", data: file }]) }).build();
  assert.equal(base.officers[0].identity.rank, "FALLBACK");
});

test("builds full_name from first + last name", () => {
  const base = new KnowledgeBuilder({
    source: source([{ key: "ภาค1/1.json", data: { region: "ภาค1", source_file: "1.jpg", normalized_extraction: extraction({ first_name: "ตติ", last_name: "พลประม" }) } }]),
  }).build();
  assert.equal(base.officers[0].identity.full_name, "ตติ พลประม");
});

test("collects distinct non-empty units from top-level and timeline", () => {
  const base = new KnowledgeBuilder({
    source: source([{ key: "ภาค1/1.json", data: { region: "ภาค1", source_file: "1.jpg", normalized_extraction: extraction() } }]),
  }).build();
  const units = base.officers[0].units;
  assert.ok(units.includes("ตชด.447"));
  assert.ok(units.includes("สภ.นาวัง"));
  // "ตชด.447" appears as both top-level and a timeline unit but is not duplicated.
  assert.equal(units.filter((u) => u === "ตชด.447").length, 1);
});

test("skips a file with no usable extraction", () => {
  const base = new KnowledgeBuilder({ source: source([{ key: "x.json", data: { region: "ภาค1" } }]) }).build();
  assert.equal(base.officers.length, 0);
});

test("empty exports produce an empty, well-formed knowledge base", () => {
  const base = new KnowledgeBuilder({ source: source([]) }).build();
  assert.equal(base.officers.length, 0);
  assert.equal(base.indexes.byId.size, 0);
  assert.equal(base.indexes.byRank.size, 0);
  assert.equal(base.indexes.byUnit.size, 0);
  assert.equal(base.indexes.byPhone.size, 0);
});

test("indexes are populated: rank, unit, phone, id", () => {
  const base = new KnowledgeBuilder({
    source: source([{ key: "ภาค1/5.json", data: { region: "ภาค1", source_file: "5.jpg", normalized_extraction: extraction() } }]),
  }).build();

  assert.ok(base.indexes.byId.has("ภาค1/5"));
  assert.equal(base.indexes.byRank.get("ร.ต.ท.")?.length, 1);
  assert.equal(base.indexes.byPhone.get("081-540-7336")?.length, 1);
  assert.equal(base.indexes.byUnit.get("ตชด.447")?.length, 1);
});
