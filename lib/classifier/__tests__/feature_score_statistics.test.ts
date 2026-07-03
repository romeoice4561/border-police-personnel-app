/**
 * Unit tests for DefaultFeatureScoreStatisticsBuilder (Phase 10B):
 * top matched features, average confidence, category distribution, UNKNOWN
 * rate. Pure — fed with hand-built ClassificationScore values.
 *
 * Run with:
 *   npx tsx --test lib/classifier/__tests__/feature_score_statistics.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DefaultFeatureScoreStatisticsBuilder } from "@/lib/classifier/feature_score_statistics";
import type { ClassificationScore, MatchedFeature } from "@/lib/classifier/classification_score";
import type { ImageCategory } from "@/lib/classifier/classification_types";

function feature(id: string, matches: number): MatchedFeature {
  return {
    id,
    category: "rank",
    votesFor: "PERSONNEL_PROFILE",
    weight: 30,
    confidenceImpact: 20,
    matches,
    reason: id,
  };
}

function score(category: ImageCategory, confidence: number, features: MatchedFeature[]): ClassificationScore {
  return {
    category,
    confidence,
    score: 50,
    categoryScores: [{ category, score: 50 }],
    reasons: [],
    topFeatures: features,
  };
}

test("empty builder reports zeroes without NaN", () => {
  const summary = new DefaultFeatureScoreStatisticsBuilder().build();
  assert.equal(summary.total_images, 0);
  assert.equal(summary.average_confidence, 0);
  assert.equal(summary.unknown_rate, 0);
  assert.equal(summary.category_distribution.PERSONNEL_PROFILE, 0);
  assert.deepEqual(summary.top_matched_features, []);
});

test("averages classification confidence across images", () => {
  const builder = new DefaultFeatureScoreStatisticsBuilder();
  builder.add(score("PERSONNEL_PROFILE", 80, [feature("rank_officer", 1)]));
  builder.add(score("PERSONNEL_PROFILE", 60, [feature("rank_officer", 1)]));
  assert.equal(builder.build().average_confidence, 70);
});

test("builds the category distribution", () => {
  const builder = new DefaultFeatureScoreStatisticsBuilder();
  builder.add(score("PERSONNEL_PROFILE", 80, []));
  builder.add(score("PERSONNEL_PROFILE", 70, []));
  builder.add(score("ORGANIZATION_CHART", 90, []));
  builder.add(score("UNKNOWN", 0, []));

  const dist = builder.build().category_distribution;
  assert.equal(dist.PERSONNEL_PROFILE, 2);
  assert.equal(dist.ORGANIZATION_CHART, 1);
  assert.equal(dist.UNKNOWN, 1);
  assert.equal(dist.MAP, 0);
});

test("ranks top matched features by number of images then total matches", () => {
  const builder = new DefaultFeatureScoreStatisticsBuilder();
  builder.add(score("PERSONNEL_PROFILE", 80, [feature("rank_officer", 2), feature("phone_number", 1)]));
  builder.add(score("PERSONNEL_PROFILE", 80, [feature("rank_officer", 3)]));
  builder.add(score("PERSONNEL_PROFILE", 80, [feature("phone_number", 1)]));

  const top = builder.build().top_matched_features;
  assert.equal(top[0].id, "rank_officer");
  assert.equal(top[0].images, 2);
  assert.equal(top[0].totalMatches, 5);
  assert.equal(top[1].id, "phone_number");
  assert.equal(top[1].images, 2);
});

test("computes the UNKNOWN rate", () => {
  const builder = new DefaultFeatureScoreStatisticsBuilder();
  builder.add(score("PERSONNEL_PROFILE", 80, []));
  builder.add(score("PERSONNEL_PROFILE", 80, []));
  builder.add(score("PERSONNEL_PROFILE", 80, []));
  builder.add(score("UNKNOWN", 0, []));

  assert.equal(builder.build().unknown_rate, 0.25);
});
