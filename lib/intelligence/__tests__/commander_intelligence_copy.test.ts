/**
 * Commander Intelligence copy-mapping tests (Phase 45.2). Confirms every
 * stable engine code maps to a real dictionary entry that renders in both
 * languages, and that no raw enum value is ever what a TranslationKey
 * resolves to.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PROMOTION_STATUS_KEY,
  RETIREMENT_STATUS_KEY,
  PRIORITY_KEY,
  COMPLETENESS_BAND_KEY,
  FLAG_KEY,
  translationKeyForRecommendation,
} from "@/lib/intelligence/commander_intelligence_copy";
import { DICTIONARY, translate } from "@/lib/i18n/dictionary";
import type { PromotionStatus, RetirementStatus, OfficerPriority, CompletenessStatus, OfficerFlagCode } from "@/lib/intelligence/types";

const PROMOTION_STATUSES: PromotionStatus[] = ["eligible", "near_eligible", "not_eligible", "unknown"];
const RETIREMENT_STATUSES: RetirementStatus[] = ["normal", "retiring_within_2_years", "retiring_within_1_year", "retired", "unknown"];
const PRIORITIES: OfficerPriority[] = ["low", "medium", "high", "critical"];
const COMPLETENESS_BANDS: CompletenessStatus[] = ["high", "medium", "low", "unknown"];
const FLAG_CODES: OfficerFlagCode[] = [
  "PROMOTION_READY",
  "NEAR_PROMOTION",
  "RETIRING_SOON",
  "NEEDS_TRAINING",
  "DOCUMENTS_MISSING",
  "PROFILE_INCOMPLETE",
  "MISSING_OFFICIAL_PORTRAIT",
];

test("every PromotionStatus has a mapped TranslationKey that resolves in both th and en", () => {
  for (const status of PROMOTION_STATUSES) {
    const key = PROMOTION_STATUS_KEY[status];
    assert.ok(DICTIONARY[key], `no dictionary entry for ${key}`);
    assert.ok(translate(key, "th").length > 0);
    assert.ok(translate(key, "en").length > 0);
  }
});

test("every RetirementStatus has a mapped TranslationKey", () => {
  for (const status of RETIREMENT_STATUSES) {
    const key = RETIREMENT_STATUS_KEY[status];
    assert.ok(DICTIONARY[key], `no dictionary entry for ${key}`);
  }
});

test("every OfficerPriority has a mapped TranslationKey", () => {
  for (const priority of PRIORITIES) {
    const key = PRIORITY_KEY[priority];
    assert.ok(DICTIONARY[key], `no dictionary entry for ${key}`);
  }
});

test("every CompletenessStatus band has a mapped TranslationKey", () => {
  for (const band of COMPLETENESS_BANDS) {
    const key = COMPLETENESS_BAND_KEY[band];
    assert.ok(DICTIONARY[key], `no dictionary entry for ${key}`);
  }
});

test("every OfficerFlagCode has a mapped TranslationKey", () => {
  for (const code of FLAG_CODES) {
    const key = FLAG_KEY[code];
    assert.ok(DICTIONARY[key], `no dictionary entry for ${key}`);
  }
});

test("spec-exact TH labels: Not Eligible / Retirement Normal / Medium Priority / Needs Training / Profile Incomplete", () => {
  assert.equal(translate(PROMOTION_STATUS_KEY.not_eligible, "th"), "ยังไม่ผ่านเกณฑ์");
  assert.equal(translate(RETIREMENT_STATUS_KEY.normal, "th"), "เกษียณตามปกติ");
  assert.equal(translate(PRIORITY_KEY.medium, "th"), "ความสำคัญปานกลาง");
  assert.equal(translate(FLAG_KEY.NEEDS_TRAINING, "th"), "ขาดหลักสูตรที่กำหนด");
  assert.equal(translate(FLAG_KEY.PROFILE_INCOMPLETE, "th"), "ข้อมูลยังไม่สมบูรณ์");
});

test("translationKeyForRecommendation maps every known English recommendation string to a TranslationKey", () => {
  const known = [
    "Officer is ready for promotion review.",
    "Review remaining promotion gaps and prepare the officer for the next cycle.",
    "Retirement planning should begin.",
    "Complete required training.",
    "Complete missing promotion documents.",
    "Update incomplete profile information.",
    "Replace missing official portrait.",
    "Complete GP7.",
  ];
  for (const recommendation of known) {
    const key = translationKeyForRecommendation(recommendation);
    assert.ok(key, `no TranslationKey mapped for "${recommendation}"`);
    assert.ok(translate(key, "th").length > 0);
  }
});

test("translationKeyForRecommendation returns null for an unmapped free-text recommendation (e.g. a document-specific label) — never throws, never guesses", () => {
  assert.equal(translationKeyForRecommendation("Complete Some Custom Document."), null);
});

test("the ANY_TRAINING-derived recommendation translates to the exact spec-approved TH text, never containing the raw code", () => {
  const key = translationKeyForRecommendation("Complete required training.");
  assert.ok(key);
  const th = translate(key!, "th");
  assert.equal(th, "เพิ่มข้อมูลหรือผ่านหลักสูตรที่ระบบกำหนด");
  assert.ok(!th.includes("ANY_TRAINING"));
});
