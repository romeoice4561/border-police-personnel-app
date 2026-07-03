/**
 * Unit tests for the QualityEngine (Phase 11B): overall score, category
 * banding, completeness breakdown, missing-field detection, recommendations,
 * and duplicate participation. Read-only; pure — built via the in-memory
 * KnowledgeBuilder source.
 *
 * Run with:
 *   npx tsx --test lib/quality/__tests__/quality_engine.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { KnowledgeBuilder, type ExportSource, type RawExport } from "@/lib/knowledge/knowledge_builder";
import type { KnowledgeBase } from "@/lib/knowledge/knowledge_types";
import type { PersonnelExtraction } from "@/lib/types/vision";
import { QualityEngine, categorize, type OfficerRecord } from "@/lib/quality/quality_engine";

function extraction(ov: Partial<PersonnelExtraction> = {}): PersonnelExtraction {
  return {
    rank: "ร.ต.ท.",
    first_name: "อนิรุทธิ์",
    last_name: "ขาวจันทร์คง",
    position: "ผบ.ร้อย",
    unit: "ตชด.447",
    phone: "081-540-7336",
    timeline: [
      { year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" },
      { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" },
    ],
    notes: "note",
    confidence: 85,
    ...ov,
  };
}

/** Builds a KnowledgeBase + paired OfficerRecords from raw exports. */
function buildRecords(exports: RawExport[]): { base: KnowledgeBase; records: OfficerRecord[] } {
  const source: ExportSource = { read: () => exports };
  const base = new KnowledgeBuilder({ source }).build();
  const byId = new Map(base.officers.map((o) => [o.identity.id, o]));

  const records: OfficerRecord[] = [];
  for (const raw of exports) {
    const ex = raw.data.normalized_extraction ?? raw.data.original_extraction;
    if (!ex) continue;
    const region = raw.data.region ?? "";
    const file = raw.data.source_file ?? "";
    const id = `${region}/${file.replace(/\.[^.]+$/, "")}`;
    const officer = byId.get(id);
    if (officer) records.push({ officer, extraction: ex });
  }
  return { base, records };
}

function exp(region: string, file: string, ov: Partial<PersonnelExtraction>): RawExport {
  return { key: `${region}/${file}`, data: { region, source_file: file, normalized_extraction: extraction(ov) } };
}

test("categorize bands scores per the spec", () => {
  assert.equal(categorize(95), "Excellent");
  assert.equal(categorize(90), "Excellent");
  assert.equal(categorize(80), "Good");
  assert.equal(categorize(75), "Good");
  assert.equal(categorize(65), "Fair");
  assert.equal(categorize(60), "Fair");
  assert.equal(categorize(59), "Poor");
});

test("a complete high-confidence record scores Excellent with no missing fields", () => {
  const { base, records } = buildRecords([exp("ภาค1", "1.jpg", {})]);
  const report = new QualityEngine().analyze(records, base);
  const q = report.officers[0];

  assert.equal(q.missing_fields.length, 0);
  assert.ok(q.quality_score >= 90);
  assert.equal(q.category, "Excellent");
  assert.equal(q.completeness.identity_completeness, 100);
  assert.equal(q.completeness.phone_quality, 100);
});

test("a sparse record scores Poor and lists missing fields + recommendations", () => {
  const { base, records } = buildRecords([
    exp("ภาค1", "2.jpg", { position: "", unit: "", phone: "", timeline: [], notes: "", confidence: 40 }),
  ]);
  const q = new QualityEngine().analyze(records, base).officers[0];

  assert.ok(q.missing_fields.includes("position"));
  assert.ok(q.missing_fields.includes("unit"));
  assert.ok(q.missing_fields.includes("phone"));
  assert.ok(q.missing_fields.includes("timeline"));
  assert.ok(q.quality_score < 60);
  assert.equal(q.category, "Poor");

  const codes = q.recommendations.map((r) => r.code);
  assert.ok(codes.includes("MISSING_TIMELINE"));
  assert.ok(codes.includes("MISSING_PHONE"));
  assert.ok(codes.includes("LOW_CONFIDENCE"));
});

test("low confidence produces a warning and a review recommendation", () => {
  const { base, records } = buildRecords([exp("ภาค1", "3.jpg", { confidence: 55 })]);
  const q = new QualityEngine().analyze(records, base).officers[0];
  assert.ok(q.warnings.some((w) => w.field === "confidence"));
  assert.ok(q.recommendations.some((r) => r.code === "LOW_CONFIDENCE"));
});

test("duplicate phone across officers is surfaced as a warning + recommendation for both", () => {
  const { base, records } = buildRecords([
    exp("ภาค1", "1.jpg", { phone: "081-111-1111", last_name: "X" }),
    exp("ภาค2", "2.jpg", { phone: "081-111-1111", last_name: "Y" }),
  ]);
  const report = new QualityEngine().analyze(records, base);

  for (const q of report.officers) {
    assert.ok(q.warnings.some((w) => w.field === "phone" && /shared/.test(w.message)));
    assert.ok(q.recommendations.some((r) => r.code === "POSSIBLE_DUPLICATE"));
  }
});

test("engine never mutates the input extraction or officer", () => {
  const { base, records } = buildRecords([exp("ภาค1", "1.jpg", {})]);
  const snapshot = JSON.parse(JSON.stringify(records[0].extraction));
  new QualityEngine().analyze(records, base);
  assert.deepEqual(records[0].extraction, snapshot);
});

test("timeline with empty rows lowers timeline completeness and warns", () => {
  const { base, records } = buildRecords([
    exp("ภาค1", "1.jpg", {
      timeline: [
        { year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" },
        { year: "", position: "", unit: "" },
      ],
    }),
  ]);
  const q = new QualityEngine().analyze(records, base).officers[0];
  assert.ok(q.completeness.timeline_completeness < 100);
  assert.ok(q.warnings.some((w) => w.field === "timeline"));
});
