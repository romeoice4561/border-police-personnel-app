/**
 * Unit tests for the quality summary (Phase 11B): category distribution,
 * average quality, missing-field tallies, duplicate counts. Read-only; pure.
 *
 * Run with:
 *   npx tsx --test lib/quality/__tests__/quality_statistics.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { KnowledgeBuilder, type ExportSource, type RawExport } from "@/lib/knowledge/knowledge_builder";
import type { KnowledgeBase } from "@/lib/knowledge/knowledge_types";
import type { PersonnelExtraction } from "@/lib/types/vision";
import { QualityEngine, type OfficerRecord } from "@/lib/quality/quality_engine";
import { buildQualitySummary } from "@/lib/quality/quality_statistics";
import { analyzeQuality } from "@/lib/quality/quality_report";

function extraction(ov: Partial<PersonnelExtraction> = {}): PersonnelExtraction {
  return {
    rank: "ร.ต.ท.",
    first_name: "A",
    last_name: "B",
    position: "ผบ.ร้อย",
    unit: "ตชด.447",
    phone: "081-540-7336",
    timeline: [{ year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" }],
    notes: "n",
    confidence: 85,
    ...ov,
  };
}

function exp(region: string, file: string, ov: Partial<PersonnelExtraction>): RawExport {
  return { key: `${region}/${file}`, data: { region, source_file: file, normalized_extraction: extraction(ov) } };
}

function build(exports: RawExport[]): { base: KnowledgeBase; records: OfficerRecord[] } {
  const source: ExportSource = { read: () => exports };
  const base = new KnowledgeBuilder({ source }).build();
  const byId = new Map(base.officers.map((o) => [o.identity.id, o]));
  const records: OfficerRecord[] = [];
  for (const raw of exports) {
    const ex = raw.data.normalized_extraction!;
    const id = `${raw.data.region}/${raw.data.source_file!.replace(/\.[^.]+$/, "")}`;
    const officer = byId.get(id);
    if (officer) records.push({ officer, extraction: ex });
  }
  return { base, records };
}

test("empty input yields a zeroed summary", () => {
  const { base, records } = build([]);
  const report = new QualityEngine().analyze(records, base);
  const s = buildQualitySummary(report, base);
  assert.equal(s.total_officers, 0);
  assert.equal(s.average_quality, 0);
  assert.equal(s.excellent + s.good + s.fair + s.poor, 0);
});

test("category counts sum to total officers", () => {
  const { base, records } = build([
    exp("ภาค1", "1.jpg", {}),
    exp("ภาค2", "2.jpg", { position: "", unit: "", phone: "", timeline: [], notes: "", confidence: 30, last_name: "Z" }),
  ]);
  const report = new QualityEngine().analyze(records, base);
  const s = buildQualitySummary(report, base);
  assert.equal(s.total_officers, 2);
  assert.equal(s.excellent + s.good + s.fair + s.poor, 2);
});

test("missing-field tallies count officers with each gap", () => {
  const { base, records } = build([
    exp("ภาค1", "1.jpg", { phone: "", last_name: "X" }),
    exp("ภาค2", "2.jpg", { unit: "", phone: "", last_name: "Y" }),
  ]);
  const report = new QualityEngine().analyze(records, base);
  const s = buildQualitySummary(report, base);
  assert.equal(s.missing_phone, 2);
  assert.equal(s.missing_unit, 1);
});

test("missing_name counts officers missing first or last name", () => {
  const { base, records } = build([
    exp("ภาค1", "1.jpg", { first_name: "" }),
    exp("ภาค2", "2.jpg", { last_name: "", first_name: "Q" }),
    exp("ภาค3", "3.jpg", { first_name: "R", last_name: "S" }),
  ]);
  const report = new QualityEngine().analyze(records, base);
  const s = buildQualitySummary(report, base);
  assert.equal(s.missing_name, 2);
});

test("duplicate phone/name counts come from knowledge detection", () => {
  const { base, records } = build([
    exp("ภาค1", "1.jpg", { phone: "081-111-1111", first_name: "สมชาย", last_name: "ใจดี" }),
    exp("ภาค2", "2.jpg", { phone: "081-111-1111", first_name: "สมชาย", last_name: "ใจดี" }),
  ]);
  const report = new QualityEngine().analyze(records, base);
  const s = buildQualitySummary(report, base);
  assert.equal(s.duplicate_phone, 1);
  assert.equal(s.duplicate_names, 1);
  assert.equal(s.duplicate_records, 2);
});

test("analyzeQuality returns ranked failure reasons and recommendation summary", () => {
  const { base, records } = build([
    exp("ภาค1", "1.jpg", { phone: "", timeline: [], confidence: 40, last_name: "X" }),
    exp("ภาค2", "2.jpg", { phone: "", confidence: 45, last_name: "Y" }),
  ]);
  const result = analyzeQuality(records, base);
  assert.ok(result.topFailureReasons.length > 0);
  assert.ok(result.recommendationSummary.some((r) => r.reason === "MISSING_PHONE"));
  // most common reason first
  const counts = result.topFailureReasons.map((r) => r.count);
  assert.deepEqual([...counts].sort((a, b) => b - a), counts);
});
