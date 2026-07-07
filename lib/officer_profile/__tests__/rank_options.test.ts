import { test } from "node:test";
import assert from "node:assert/strict";

import { RANK_OPTIONS, isValidRank } from "@/lib/officer_profile/rank_options";

test("RANK_OPTIONS includes every base rank and its หญิง variant", () => {
  assert.ok(RANK_OPTIONS.includes("พ.ต.ท."));
  assert.ok(RANK_OPTIONS.includes("พ.ต.ท.หญิง"));
  assert.ok(RANK_OPTIONS.includes("ร.ต.ต."));
  assert.ok(RANK_OPTIONS.includes("ร.ต.ต.หญิง"));
  assert.ok(RANK_OPTIONS.includes("ด.ต."));
  assert.ok(RANK_OPTIONS.includes("ด.ต.หญิง"));
});

test("isValidRank accepts every listed rank", () => {
  for (const rank of RANK_OPTIONS) assert.equal(isValidRank(rank), true);
});

test("isValidRank rejects free text / unknown ranks", () => {
  assert.equal(isValidRank("ผู้กอง"), false);
  assert.equal(isValidRank(""), false);
  assert.equal(isValidRank("31"), false);
});
