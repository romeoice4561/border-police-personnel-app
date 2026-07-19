/**
 * generateRecommendations() dedup/enum-stripping regression tests
 * (Phase 45.2 — fixes the observed live-route bug where the SAME missing-
 * training gap produced 3 differently-phrased recommendations, one of which
 * ("Complete required training. (ANY_TRAINING)") leaked the internal rule
 * code ANY_TRAINING verbatim into user-facing text).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficerIntelligenceCard } from "@/lib/intelligence";
import { buildPromotionContext, createRequiredDocumentsRule, createRequiredTrainingRule } from "@/lib/promotion";
import { utcDate } from "@/lib/personnel_calendar";
import type { OfficerIntelligenceInput } from "@/lib/intelligence";

/** Mirrors lib/intelligence/officer_intelligence_input.ts's toIntelligenceInput exactly: an officer WITH some training records (so the "ANY_TRAINING" sentinel requirement is injected and missing) but not the specific required course. */
function officerWithUnmetAnyTrainingRequirement(): OfficerIntelligenceInput {
  const promotionContext = buildPromotionContext({
    asOf: utcDate(2026, 7, 19),
    dateOfBirth: utcDate(1985, 9, 30),
    governmentServiceStartDate: utcDate(2005, 1, 1),
    // Real training records exist, but NOT the "ANY_TRAINING" sentinel code
    // itself — reproduces toIntelligenceInput's exact injected-requirement shape.
    trainingRecords: [{ code: "SOME_OTHER_COURSE" }],
    documents: [{ typeCode: "GP7", isActive: true }],
  });

  return {
    officerId: "off-any-training",
    displayName: "Test Officer",
    promotionContext,
    promotionRules: [
      createRequiredDocumentsRule({ requiredDocumentTypes: ["GP7"], score: 20 }),
      createRequiredTrainingRule({ requiredTrainingCodes: ["ANY_TRAINING"], score: 20 }),
    ],
    profileCompletenessPercent: 50,
    hasOfficialPortrait: true,
    documents: [{ typeCode: "GP7", isActive: true }],
    trainingRecords: [{ code: "SOME_OTHER_COURSE" }],
  };
}

test("bug fix: a missing ANY_TRAINING requirement produces exactly ONE training recommendation, not three differently-phrased duplicates", () => {
  const card = buildOfficerIntelligenceCard(officerWithUnmetAnyTrainingRequirement());

  const trainingRecommendations = card.recommendations.filter((r) => /training/i.test(r));
  assert.equal(trainingRecommendations.length, 1, `expected exactly 1 training recommendation, got: ${JSON.stringify(trainingRecommendations)}`);
  assert.equal(trainingRecommendations[0], "Complete required training.");
});

test("bug fix: the raw internal rule code ANY_TRAINING never appears in any recommendation string", () => {
  const card = buildOfficerIntelligenceCard(officerWithUnmetAnyTrainingRequirement());
  for (const recommendation of card.recommendations) {
    assert.ok(!recommendation.includes("ANY_TRAINING"), `recommendation leaked a raw code: "${recommendation}"`);
  }
});

test("bug fix: no recommendation ever contains a raw code in parentheses or after a colon (the two leak patterns observed live)", () => {
  const card = buildOfficerIntelligenceCard(officerWithUnmetAnyTrainingRequirement());
  for (const recommendation of card.recommendations) {
    assert.ok(!/\([A-Z_]+\)/.test(recommendation), `recommendation has a parenthesized code: "${recommendation}"`);
    assert.ok(!/:\s*[A-Z_]{4,}\.?$/.test(recommendation), `recommendation has a trailing raw code: "${recommendation}"`);
  }
});

test("a NEEDS_TRAINING flag combined with the same missing requirement still collapses to one recommendation (flag takes priority, matches its own RECOMMENDATION_BY_FLAG text)", () => {
  const card = buildOfficerIntelligenceCard(officerWithUnmetAnyTrainingRequirement());
  assert.ok(card.flags.some((f) => f.code === "NEEDS_TRAINING"));
  const trainingRecommendations = card.recommendations.filter((r) => /training/i.test(r));
  assert.equal(trainingRecommendations.length, 1);
});

test("distinct topics (training + documents) still each produce their own recommendation — dedup is per-topic, not global", () => {
  const promotionContext = buildPromotionContext({
    asOf: utcDate(2026, 7, 19),
    dateOfBirth: utcDate(1985, 9, 30),
    governmentServiceStartDate: utcDate(2005, 1, 1),
    trainingRecords: [],
    documents: [],
  });
  const card = buildOfficerIntelligenceCard({
    officerId: "off-multi-gap",
    displayName: "Test Officer",
    promotionContext,
    promotionRules: [
      createRequiredDocumentsRule({ requiredDocumentTypes: ["GP7"], score: 20 }),
      createRequiredTrainingRule({ requiredTrainingCodes: ["ANY_TRAINING"], score: 20 }),
    ],
    profileCompletenessPercent: 40,
    hasOfficialPortrait: true,
    documents: [],
    trainingRecords: [],
  });

  assert.ok(card.recommendations.some((r) => /training/i.test(r)));
  assert.ok(card.recommendations.includes("Complete GP7."));
});
