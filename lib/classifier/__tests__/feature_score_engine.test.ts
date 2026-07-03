/**
 * Unit tests for the Phase 10B weighted-feature-scoring classification
 * engine, extractor, and dictionary. Emphasis (per the task) on robustness to
 * OCR noise: garbled characters, dropped dots, mixed Thai/Arabic, Thai
 * numerals, and stray spacing. Pure — no OCR, no OpenAI, no network.
 *
 * Run with:
 *   npx tsx --test lib/classifier/__tests__/feature_score_engine.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FeatureScoreEngine } from "@/lib/classifier/feature_score_engine";
import { TextFeatureExtractor, measureTextStructure, normalizeForMatching } from "@/lib/classifier/text_feature_extractor";
import type { ClassificationSignals } from "@/lib/classifier/classification_types";
import type { TemplateDetectionResult, LayoutFeatureSet } from "@/lib/layout/layout_types";

/** Baseline layout signals: no portrait, no timeline, unknown template — so text drives the decision. */
function baseSignals(textSample: string | undefined): ClassificationSignals {
  const detection: TemplateDetectionResult = {
    template_id: "unknown",
    confidence: 0,
    category: "Unknown",
    version: "1",
    orientation: "portrait",
  };
  const features: LayoutFeatureSet = {
    textDensity: "moderate",
    timelineOrientation: "none",
    backgroundStyle: "plain",
    dominantRegions: [],
    orientation: "portrait",
  };
  return { detection, features, textSample };
}

const engine = new FeatureScoreEngine();

test("classifies a Border Patrol officer profile card as PERSONNEL_PROFILE (would reach OpenAI)", () => {
  // Real OCR text observed in Phase 10A for ภาค4/147.png (officer card).
  const ocr = "w.a.n. ศักริแทร์ อนุสามัญสกุล รอง ผกก.หน.ร้อย ตชด.447 081-5407336";
  const result = engine.classify(baseSignals(ocr));

  assert.equal(result.category, "PERSONNEL_PROFILE");
  assert.equal(result.shouldProcess, true);
  assert.ok(result.confidence > 0);
});

test("tolerates OCR dropping the dots in a rank abbreviation", () => {
  // "พ.ต.ท." often OCRs without dots as "พตท".
  const result = engine.classify(baseSignals("พตท สมชาย ใจดี รอง ผกก ตชด 081-5551234"));
  assert.equal(result.category, "PERSONNEL_PROFILE");
});

test("tolerates stray spacing inserted between characters by OCR", () => {
  const result = engine.classify(baseSignals("ร้อย  ตชด . 445    081 - 540 - 7336   ผกก."));
  assert.equal(result.category, "PERSONNEL_PROFILE");
});

test("converts Thai-numeral phone numbers before matching (๐๘๑-๕๕๕๑๒๓๔)", () => {
  const result = engine.classify(baseSignals("ด.ต. สมหญิง โทร ๐๘๑-๕๕๕๑๒๓๔ ตชด.๔๔๗"));
  assert.equal(result.category, "PERSONNEL_PROFILE");
});

test("mixed Thai + English text still classifies on the Thai domain signals", () => {
  const result = engine.classify(baseSignals("Name: พ.ต.ท. John ตชด.447 Phone 081-5407336 Company"));
  assert.equal(result.category, "PERSONNEL_PROFILE");
});

test("an organization chart is not misread as a personnel profile despite listing ranks", () => {
  const org = "ผังการจัด โครงสร้าง ระดับ บก. พ.ต.อ. พ.ต.ท. ร.ต.อ. ด.ต. หลายนาย";
  const result = engine.classify(baseSignals(org));
  assert.equal(result.category, "ORGANIZATION_CHART");
  assert.equal(result.shouldProcess, false);
});

test("a table-of-contents page classifies as INDEX_PAGE, never PERSONNEL_PROFILE", () => {
  const result = engine.classify(baseSignals("สารบัญ หน้าที่ 1 หน้าที่ 2 หน้าที่ 3"));
  assert.equal(result.category, "INDEX_PAGE");
  assert.equal(result.shouldProcess, false);
});

test("a cover page classifies as COVER_PAGE", () => {
  const result = engine.classify(baseSignals("คำนำ จัดทำโดย กองบังคับการ"));
  assert.equal(result.category, "COVER_PAGE");
  assert.equal(result.shouldProcess, false);
});

test("a career-timeline page classifies as TIMELINE", () => {
  const result = engine.classify(baseSignals("Timeline รับราชการ ประวัติการรับราชการ ดำรงตำแหน่ง 2560 2562 2564"));
  assert.equal(result.category, "TIMELINE");
});

test("pure OCR garbage with no domain signal stays UNKNOWN", () => {
  const result = engine.classify(baseSignals("oo EE 6๒ Ea = THEY ๕5 xzq !!"));
  assert.equal(result.category, "UNKNOWN");
  assert.equal(result.confidence, 0);
});

test("empty OCR text with no portrait signal is UNKNOWN (matches pre-10B blank behaviour)", () => {
  const result = engine.classify(baseSignals(undefined));
  assert.equal(result.category, "UNKNOWN");
});

test("score() exposes reasons and top matched features for transparency", () => {
  const scored = engine.score(baseSignals("พ.ต.ท. ศักดิ์ ตชด.447 081-5407336"));
  assert.equal(scored.category, "PERSONNEL_PROFILE");
  assert.ok(scored.reasons.length > 0);
  assert.ok(scored.topFeatures.length > 0);
  // Rank should be among the strongest contributors.
  assert.ok(scored.topFeatures.some((f) => f.id === "rank_officer"));
  assert.ok(scored.categoryScores[0].score >= scored.categoryScores[scored.categoryScores.length - 1].score);
});

test("a portrait layout signal alone can carry a text-poor card to PERSONNEL_PROFILE", () => {
  const signals = baseSignals("ตชด");
  signals.features.photoRegion = { x: 0.1, y: 0.1, w: 0.3, h: 0.4 };
  signals.features.timelineOrientation = "vertical";
  const result = engine.classify(signals);
  assert.equal(result.category, "PERSONNEL_PROFILE");
});

test("normalizeForMatching converts Thai numerals and collapses whitespace", () => {
  assert.equal(normalizeForMatching("๐๘๑   ตชด\n\n๔๔๗"), "081 ตชด 447");
});

test("measureTextStructure counts words, numbers, and non-blank lines", () => {
  const s = measureTextStructure("พ.ต.ท. สมชาย\nตชด.447\n081-5407336");
  assert.ok(s.wordCount >= 3);
  assert.ok(s.numberCount >= 2);
  assert.equal(s.lineCount, 3);
});

test("the extractor returns weighted features that vote for a category", () => {
  const features = new TextFeatureExtractor().extract(baseSignals("พ.ต.ท. ตชด.447 081-5407336"));
  assert.ok(features.some((f) => f.id === "rank_officer" && f.votesFor === "PERSONNEL_PROFILE"));
  assert.ok(features.some((f) => f.id === "phone_number"));
  assert.ok(features.some((f) => f.id === "border_patrol_unit"));
});
