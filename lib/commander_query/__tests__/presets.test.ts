import { test } from "node:test";
import assert from "node:assert/strict";

import { COMMANDER_PRESETS } from "@/lib/commander_query/presets";
import { PROMOTION_TARGET_LEVELS } from "@/lib/promotion/eligibility_policy";

// Phase 41 Part 5 — Commander Search presets.

test("there is one 'ready for level' preset per configured target level, plus the fixed presets", () => {
  const readyPresets = COMMANDER_PRESETS.filter((p) => p.id.startsWith("ready-"));
  assert.equal(readyPresets.length, PROMOTION_TARGET_LEVELS.length);
  for (const level of PROMOTION_TARGET_LEVELS) {
    const preset = readyPresets.find((p) => p.filters.toPositionLevel === level);
    assert.ok(preset, `preset exists for ${level}`);
    assert.equal(preset!.filters.eligibilityStatus, "eligible_now");
    assert.equal(preset!.labelTh, `ผู้ครบขึ้น ${level}`);
  }
});

test("the required fixed presets are all present with the expected filters", () => {
  const byId = new Map(COMMANDER_PRESETS.map((p) => [p.id, p]));
  assert.equal(byId.get("near-retirement")?.filters.flagCode, "RETIRING_SOON");
  assert.equal(byId.get("eligible-two-step")?.filters.eligibleTwoStepOnly, true);
  assert.equal(byId.get("must-skip-step")?.filters.mustSkipStepOnly, true);
  assert.equal(byId.get("missing-gp7")?.filters.missingGp7Only, true);
  assert.equal(byId.get("missing-documents")?.filters.flagCode, "DOCUMENTS_MISSING");
  assert.equal(byId.get("missing-training")?.filters.flagCode, "NEEDS_TRAINING");
  assert.equal(byId.get("missing-portrait")?.filters.flagCode, "MISSING_OFFICIAL_PORTRAIT");
});

test("every preset has a stable id and bilingual labels", () => {
  const ids = new Set<string>();
  for (const preset of COMMANDER_PRESETS) {
    assert.ok(preset.id.length > 0);
    assert.equal(ids.has(preset.id), false, `duplicate preset id ${preset.id}`);
    ids.add(preset.id);
    assert.ok(preset.labelTh.length > 0);
    assert.ok(preset.labelEn.length > 0);
  }
});
