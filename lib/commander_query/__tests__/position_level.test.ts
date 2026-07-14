import { test } from "node:test";
import assert from "node:assert/strict";

import {
  POSITION_LEVELS,
  RANKED_POSITION_LEVELS,
  POSITION_LEVEL_ORDER,
  UNKNOWN_POSITION_LEVEL,
  isPositionLevel,
  normalizePositionLevel,
  nextPositionLevel,
  mapPositionTextToLevel,
} from "@/lib/commander_query/position_level";

// Phase 41 Part 1 — Career Position Level (structured, BPP-scoped).

test("POSITION_LEVELS is the closed BPP set, Unknown first, lowest → highest", () => {
  assert.deepEqual(POSITION_LEVELS, [
    "Unknown",
    "รองสารวัตร",
    "สารวัตร",
    "รองผู้กำกับการ",
    "ผู้กำกับการ",
    "รองผู้บังคับการ",
    "ผู้บังคับการ",
    "รองผู้บัญชาการ",
  ]);
});

test("RANKED_POSITION_LEVELS excludes Unknown but keeps order", () => {
  assert.equal(RANKED_POSITION_LEVELS.includes(UNKNOWN_POSITION_LEVEL as never), false);
  assert.equal(RANKED_POSITION_LEVELS[0], "รองสารวัตร");
  assert.equal(RANKED_POSITION_LEVELS.at(-1), "รองผู้บัญชาการ");
});

test("POSITION_LEVEL_ORDER ranks Unknown lowest and รองผู้บัญชาการ highest", () => {
  assert.equal(POSITION_LEVEL_ORDER["Unknown"], 0);
  assert.equal(POSITION_LEVEL_ORDER["รองสารวัตร"], 1);
  assert.ok(POSITION_LEVEL_ORDER["รองผู้บัญชาการ"] > POSITION_LEVEL_ORDER["ผู้บังคับการ"]);
});

test("isPositionLevel accepts canonical strings, rejects anything else", () => {
  assert.equal(isPositionLevel("สารวัตร"), true);
  assert.equal(isPositionLevel("Unknown"), true);
  assert.equal(isPositionLevel("ผู้กำกับ"), false); // short form (no การ) is NOT canonical
  assert.equal(isPositionLevel(null), false);
  assert.equal(isPositionLevel(""), false);
});

test("normalizePositionLevel maps null/blank/unrecognized to Unknown, passes canonical through", () => {
  assert.equal(normalizePositionLevel(null), "Unknown");
  assert.equal(normalizePositionLevel(""), "Unknown");
  assert.equal(normalizePositionLevel("something legacy"), "Unknown");
  assert.equal(normalizePositionLevel("ผู้กำกับการ"), "ผู้กำกับการ");
});

test("nextPositionLevel returns the level immediately above, null at top / for Unknown", () => {
  assert.equal(nextPositionLevel("รองสารวัตร"), "สารวัตร");
  assert.equal(nextPositionLevel("ผู้กำกับการ"), "รองผู้บังคับการ");
  assert.equal(nextPositionLevel("รองผู้บัญชาการ"), null); // top of the BPP scope
  assert.equal(nextPositionLevel("Unknown"), null);
});

test("mapPositionTextToLevel: deputy variants win over their base level", () => {
  assert.equal(mapPositionTextToLevel("รอง ผกก.ฝอ."), "รองผู้กำกับการ");
  assert.equal(mapPositionTextToLevel("ผกก."), "ผู้กำกับการ");
  assert.equal(mapPositionTextToLevel("รอง สว."), "รองสารวัตร");
  assert.equal(mapPositionTextToLevel("สว.สส."), "สารวัตร");
});

test("mapPositionTextToLevel: full official names map correctly", () => {
  assert.equal(mapPositionTextToLevel("รองผู้บังคับการ"), "รองผู้บังคับการ");
  assert.equal(mapPositionTextToLevel("ผู้บังคับการ"), "ผู้บังคับการ");
  assert.equal(mapPositionTextToLevel("รองผู้บัญชาการ"), "รองผู้บัญชาการ");
});

test("mapPositionTextToLevel: unmapped / non-command titles return Unknown (never guessed)", () => {
  assert.equal(mapPositionTextToLevel("ผบ.หมู่"), "Unknown");
  assert.equal(mapPositionTextToLevel(""), "Unknown");
  assert.equal(mapPositionTextToLevel(null), "Unknown");
  assert.equal(mapPositionTextToLevel("ครูฝึก"), "Unknown");
});

test("mapPositionTextToLevel is whitespace/dot insensitive", () => {
  assert.equal(mapPositionTextToLevel("รอง  ผกก .ป."), "รองผู้กำกับการ");
  assert.equal(mapPositionTextToLevel("ผบก . อก ."), "ผู้บังคับการ");
});
