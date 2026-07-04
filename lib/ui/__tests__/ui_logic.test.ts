/**
 * UI logic tests (Phase 14): the pure logic backing the components — quality
 * banding, list/search query building, and review flagging. These are the
 * component-behavior units testable under the node:test runner (no DOM).
 *
 * Run with:
 *   npx tsx --test lib/ui/__tests__/ui_logic.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { bandForScore } from "@/lib/ui/quality";
import { buildOfficerQuery, buildSearchQuery, hasSearchCriteria } from "@/lib/ui/list_filters";
import { EMPTY_SEARCH, type SearchFormValue } from "@/components/common/search_bar";
import { reviewFlags, needsReview } from "@/lib/ui/review";
import type { OfficerSummary } from "@/lib/ui/api_client";

// ---- quality banding ----

test("bandForScore maps scores to bands + status tones", () => {
  assert.deepEqual(bandForScore(95), { band: "Excellent", tone: "good" });
  assert.deepEqual(bandForScore(80), { band: "Good", tone: "good" });
  assert.deepEqual(bandForScore(65), { band: "Fair", tone: "warning" });
  assert.deepEqual(bandForScore(40), { band: "Poor", tone: "critical" });
  assert.deepEqual(bandForScore(null), { band: "Unknown", tone: "neutral" });
});

// ---- list filters / query building ----

test("buildOfficerQuery includes paging/sort and drops empty filters", () => {
  const q = buildOfficerQuery({ rank: "ร.ต.ท.", unit: "", minQuality: 80 }, 2, 20, "careerYears", "desc");
  assert.equal(q.page, 2);
  assert.equal(q.pageSize, 20);
  assert.equal(q.sortBy, "careerYears");
  assert.equal(q.rank, "ร.ต.ท.");
  assert.equal(q.minQuality, 80);
  assert.equal("unit" in q, false); // empty dropped
});

test("hasSearchCriteria requires at least one field", () => {
  assert.equal(hasSearchCriteria(EMPTY_SEARCH), false);
  assert.equal(hasSearchCriteria({ ...EMPTY_SEARCH, name: "som" }), true);
  assert.equal(hasSearchCriteria({ ...EMPTY_SEARCH, minQuality: "80" }), true);
});

test("buildSearchQuery parses numbers, trims text, sets match, drops blanks", () => {
  const form: SearchFormValue = {
    ...EMPTY_SEARCH,
    name: "  som ",
    unit: "",
    minQuality: "75",
    minCareerYears: "",
    match: "startsWith",
  };
  const q = buildSearchQuery(form, 1, 20);
  assert.equal(q.name, "som");
  assert.equal(q.match, "startsWith");
  assert.equal(q.minQuality, 75);
  assert.equal("unit" in q, false);
  assert.equal("minCareerYears" in q, false);
});

// ---- review flagging ----

function officer(ov: Partial<OfficerSummary> = {}): OfficerSummary {
  return {
    officerId: "ภาค1/1",
    rank: "ร.ต.ท.",
    firstName: "A",
    lastName: "B",
    currentPosition: "ผบ.ร้อย",
    currentUnit: "ตชด.447",
    phone: "081-540-7336",
    careerYears: 10,
    qualityScore: 90,
    knowledgeScore: 80,
    region: "ภาค1",
    confidence: 80,
    ...ov,
  };
}

test("a complete high-quality officer has no review flags", () => {
  assert.deepEqual(reviewFlags(officer()), []);
  assert.equal(needsReview(officer()), false);
});

test("poor quality flags 'poor'; fair flags 'fair'", () => {
  assert.ok(reviewFlags(officer({ qualityScore: 40 })).includes("poor"));
  assert.ok(reviewFlags(officer({ qualityScore: 65 })).includes("fair"));
});

test("low confidence is flagged", () => {
  assert.ok(reviewFlags(officer({ confidence: 55 })).includes("low_confidence"));
});

test("missing rank flags identity_incomplete + missing_rank", () => {
  const flags = reviewFlags(officer({ rank: "" }));
  assert.ok(flags.includes("missing_rank"));
  assert.ok(flags.includes("identity_incomplete"));
});

test("missing phone and zero career years are flagged", () => {
  const flags = reviewFlags(officer({ phone: null, careerYears: 0 }));
  assert.ok(flags.includes("missing_phone"));
  assert.ok(flags.includes("missing_timeline"));
});
