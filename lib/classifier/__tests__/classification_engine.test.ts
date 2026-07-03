/**
 * Unit tests for the Smart Image Classification Engine (Phase 8.5).
 *
 * Run with: npx tsx --test lib/classifier/__tests__/classification_engine.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ClassificationEngine } from "@/lib/classifier/classification_engine";
import type { ClassificationSignals } from "@/lib/classifier/classification_types";
import type { LayoutFeatureSet, TemplateDetectionResult } from "@/lib/layout/layout_types";

function detection(overrides: Partial<TemplateDetectionResult> = {}): TemplateDetectionResult {
  return {
    template_id: "unknown",
    confidence: 50,
    category: "Unknown",
    version: "0",
    orientation: "portrait",
    ...overrides,
  };
}

function features(overrides: Partial<LayoutFeatureSet> = {}): LayoutFeatureSet {
  return {
    headerPosition: undefined,
    photoRegion: undefined,
    textDensity: "moderate",
    timelineOrientation: "none",
    backgroundStyle: "unknown",
    dominantRegions: [],
    orientation: "portrait",
    ...overrides,
  };
}

function signals(overrides: Partial<ClassificationSignals> = {}): ClassificationSignals {
  return {
    detection: detection(),
    features: features(),
    ...overrides,
  };
}

test("personnel profile: text sample containing 'Timeline รับราชการ' classifies as PERSONNEL_PROFILE and should process", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "Timeline รับราชการ ของ พ.ต.อ. สมชาย" }));

  assert.equal(result.category, "PERSONNEL_PROFILE");
  assert.equal(result.shouldProcess, true);
  assert.ok(result.confidence >= 60);
});

test("personnel profile: portrait region + timeline layout signal classifies as PERSONNEL_PROFILE without any text sample", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(
    signals({
      features: features({
        photoRegion: { x: 0.1, y: 0.1, w: 0.2, h: 0.3 },
        timelineOrientation: "vertical",
      }),
    })
  );

  assert.equal(result.category, "PERSONNEL_PROFILE");
  assert.equal(result.shouldProcess, true);
});

test("timeline: layout detector 'Timeline' category with no stronger signal classifies as TIMELINE and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ detection: detection({ category: "Timeline", confidence: 80 }) }));

  assert.equal(result.category, "TIMELINE");
  assert.equal(result.shouldProcess, false);
});

test("organization chart: text sample containing 'ระดับ บก.' classifies as ORGANIZATION_CHART and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "ระดับ บก. กองบังคับการ" }));

  assert.equal(result.category, "ORGANIZATION_CHART");
  assert.equal(result.shouldProcess, false);
});

test("organization chart: text sample containing 'ระดับ กก.' classifies as ORGANIZATION_CHART and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "ระดับ กก. กองกำกับการ" }));

  assert.equal(result.category, "ORGANIZATION_CHART");
  assert.equal(result.shouldProcess, false);
});

test("organization chart: text sample containing 'ผัง' classifies as ORGANIZATION_CHART and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "ผังโครงสร้างหน่วยงาน" }));

  assert.equal(result.category, "ORGANIZATION_CHART");
  assert.equal(result.shouldProcess, false);
});

test("cover page: text sample containing 'คำนำ' classifies as COVER_PAGE and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "คำนำ เอกสารฉบับนี้จัดทำขึ้นเพื่อ" }));

  assert.equal(result.category, "COVER_PAGE");
  assert.equal(result.shouldProcess, false);
});

test("title page: text sample containing 'เฉพาะตราหน่วย' classifies as TITLE_PAGE and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "เฉพาะตราหน่วย" }));

  assert.equal(result.category, "TITLE_PAGE");
  assert.equal(result.shouldProcess, false);
});

test("index page: text sample containing 'สารบัญ' classifies as INDEX_PAGE and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals({ textSample: "สารบัญ หน้า 1" }));

  assert.equal(result.category, "INDEX_PAGE");
  assert.equal(result.shouldProcess, false);
});

test("unknown: no text sample and neutral layout/features classifies as UNKNOWN and should skip", () => {
  const engine = new ClassificationEngine();
  const result = engine.classify(signals());

  assert.equal(result.category, "UNKNOWN");
  assert.equal(result.shouldProcess, false);
});

test("low confidence: a matching rule below the 60 threshold is downgraded to UNKNOWN and skipped", () => {
  const engine = new ClassificationEngine({
    rules: [
      {
        evaluate: () => ({
          category: "PERSONNEL_PROFILE",
          confidence: 45,
          reason: "test rule intentionally below threshold",
          shouldProcess: true,
        }),
      },
    ],
  });

  const result = engine.classify(signals());

  assert.equal(result.category, "UNKNOWN");
  assert.equal(result.shouldProcess, false);
  assert.equal(result.confidence, 0);
});

test("only PERSONNEL_PROFILE ever has shouldProcess = true", () => {
  const engine = new ClassificationEngine();

  const categories: Array<[string, ClassificationSignals]> = [
    ["timeline", signals({ detection: detection({ category: "Timeline", confidence: 80 }) })],
    ["organization", signals({ textSample: "ผัง" })],
    ["cover", signals({ textSample: "คำนำ" })],
    ["title", signals({ textSample: "เฉพาะตราหน่วย" })],
    ["index", signals({ textSample: "สารบัญ" })],
    ["unknown", signals()],
  ];

  for (const [label, sig] of categories) {
    const result = engine.classify(sig);
    assert.notEqual(result.category, "PERSONNEL_PROFILE", `expected ${label} not to classify as PERSONNEL_PROFILE`);
    assert.equal(result.shouldProcess, false, `expected ${label} to have shouldProcess = false`);
  }
});

test("classification never depends on filename/path — signals contain no such fields", () => {
  const engine = new ClassificationEngine();
  const sig = signals({ textSample: "Timeline รับราชการ" });

  // Structural guarantee: ClassificationSignals has no filename/path field
  // for a rule to even accidentally read.
  assert.ok(!("filename" in sig));
  assert.ok(!("path" in sig));
  assert.ok(!("folder" in sig));

  const result = engine.classify(sig);
  assert.equal(result.category, "PERSONNEL_PROFILE");
});
