import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDefaultExtractionSettings, DEFAULT_EXTRACTION_SETTINGS } from "@/lib/extraction/extraction_settings";
import { DEFAULT_AI_USAGE_POLICY } from "@/lib/extraction/budget_policy";
import { DEFAULT_CONFIDENCE_POLICY } from "@/lib/extraction/confidence";
import { DEFAULT_GOVERNANCE_POLICY } from "@/lib/extraction/governance_policy";

test("settings mirror the canonical policy defaults exactly — no re-guessed values", () => {
  const settings = buildDefaultExtractionSettings();
  assert.equal(settings.maxPageCount, DEFAULT_AI_USAGE_POLICY.maxPageCount);
  assert.equal(settings.maxFileSizeBytes, DEFAULT_AI_USAGE_POLICY.maxFileSizeBytes);
  assert.equal(settings.aiEnabled, DEFAULT_AI_USAGE_POLICY.aiFallbackEnabled);
  assert.equal(settings.confirmationRequired, DEFAULT_AI_USAGE_POLICY.requireUserConfirmation);
  assert.deepEqual(settings.confidencePolicy, DEFAULT_CONFIDENCE_POLICY);
  assert.deepEqual(settings.governancePolicy, DEFAULT_GOVERNANCE_POLICY);
});

test("queueEnabled and nearDuplicateEnabled default to false (no worker, no real near-dup provider exists yet)", () => {
  const settings = buildDefaultExtractionSettings();
  assert.equal(settings.queueEnabled, false);
  assert.equal(settings.nearDuplicateEnabled, false);
});

test("DEFAULT_EXTRACTION_SETTINGS module-level constant matches a fresh build", () => {
  assert.deepEqual(DEFAULT_EXTRACTION_SETTINGS, buildDefaultExtractionSettings());
});
