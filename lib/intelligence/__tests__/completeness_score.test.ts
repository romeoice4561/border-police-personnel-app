import { test } from "node:test";
import assert from "node:assert/strict";

import { computeCompletenessScore } from "@/lib/intelligence/completeness_score";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";

test("zero documents -> overallScore 0, every category with checklist items listed as missing", () => {
  const score = computeCompletenessScore([]);
  assert.equal(score.overallScore, 0);
  assert.ok(score.missingCategories.includes("IDENTITY"));
  assert.ok(score.missingRequiredDocuments.length > 0);
});

test("every recommended document present (except portrait, which this module never scores) -> IDENTITY category at 100%", () => {
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID" }),
    fixtureDoc({ documentType: "HOUSE_REGISTRATION" }),
  ];
  const score = computeCompletenessScore(docs);
  const identity = score.categoryScores.find((c) => c.category === "IDENTITY");
  assert.ok(identity);
  assert.equal(identity!.percent, 100);
  assert.ok(!score.missingCategories.includes("IDENTITY"));
});

test("categories with zero checklist items (none in this registry) report percent 0 but are never listed as missing", () => {
  const score = computeCompletenessScore([]);
  const zeroTotalCategories = score.categoryScores.filter((c) => c.totalCount === 0);
  for (const cat of zeroTotalCategories) {
    assert.equal(score.missingCategories.includes(cat.category), false, `${cat.category} has no checklist items and must not be reported as 'missing'`);
  }
});

test("overallScore is the unweighted average of category percents, excluding categories with zero checklist items", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID" }), fixtureDoc({ documentType: "HOUSE_REGISTRATION" })];
  const score = computeCompletenessScore(docs);
  const scoredCategories = score.categoryScores.filter((c) => c.totalCount > 0);
  const expected = Math.round(scoredCategories.reduce((sum, c) => sum + c.percent, 0) / scoredCategories.length);
  assert.equal(score.overallScore, expected);
});

test("missingRequiredDocuments lists checklist codes with no active document, excluding OFFICIAL_PORTRAIT", () => {
  const score = computeCompletenessScore([]);
  assert.ok(!score.missingRequiredDocuments.includes("OFFICIAL_PORTRAIT"), "portrait is resolved separately, never expected as a document row");
  assert.ok(score.missingRequiredDocuments.includes("GP7"));
});

test("inactive (superseded) documents do not count toward completeness", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", isActive: false })];
  const score = computeCompletenessScore(docs);
  assert.ok(score.missingRequiredDocuments.includes("NATIONAL_ID"));
});

test("categoryScores always covers all 7 spec categories, in the documented order", () => {
  const score = computeCompletenessScore([]);
  assert.deepEqual(
    score.categoryScores.map((c) => c.category),
    ["IDENTITY", "OPERATIONAL", "EDUCATION", "TRAINING", "AWARDS", "MEDICAL", "FINANCIAL"]
  );
});
