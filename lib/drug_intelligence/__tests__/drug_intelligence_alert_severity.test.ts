/**
 * Tests for the DI-6 alert severity rules — deterministic, no scoring
 * model. Exercises every documented threshold in
 * drug_intelligence_alert_severity.ts exactly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveRepeatEntitySeverity,
  deriveRepeatPersonSeverity,
  deriveNewNetworkConnectionSeverity,
  deriveHighConfidenceDuplicateSeverity,
} from "@/lib/drug_intelligence/drug_intelligence_alert_severity";

test("repeat entity: zero prior cases is INFO (boundary — should never actually be called with 0 since alerts require priorCaseCount > 0, but the rule itself must still resolve deterministically)", () => {
  assert.equal(deriveRepeatEntitySeverity(0, 0), "INFO");
});

test("repeat entity: exactly 1 prior case, 0 related persons is INFO", () => {
  assert.equal(deriveRepeatEntitySeverity(1, 0), "INFO");
});

test("repeat entity: 2 prior cases, 1 related person is NOTICE (multiple cases but not multiple distinct people)", () => {
  assert.equal(deriveRepeatEntitySeverity(2, 1), "NOTICE");
});

test("repeat entity: 2 prior cases AND 2+ related persons is HIGH (reused identifier links multiple distinct people)", () => {
  assert.equal(deriveRepeatEntitySeverity(2, 2), "HIGH");
});

test("repeat entity: 1 prior case but 2 related persons is still INFO (priorCaseCount gates first — a single case with two people sharing an entity within the SAME case is not itself a cross-case signal)", () => {
  assert.equal(deriveRepeatEntitySeverity(1, 2), "INFO");
});

test("repeat entity: many prior cases and many related persons stays HIGH, never escalates further (HIGH is the ceiling)", () => {
  assert.equal(deriveRepeatEntitySeverity(50, 50), "HIGH");
});

test("repeat person: case count 1 is NOTICE (function itself does not special-case 'not a repeat' — the SERVICE layer only calls this when priorCaseCount > 0)", () => {
  assert.equal(deriveRepeatPersonSeverity(1), "NOTICE");
});

test("repeat person: case count 2 is NOTICE", () => {
  assert.equal(deriveRepeatPersonSeverity(2), "NOTICE");
});

test("repeat person: case count 3 is HIGH (appears across 3+ cases)", () => {
  assert.equal(deriveRepeatPersonSeverity(3), "HIGH");
});

test("repeat person: case count above 3 stays HIGH", () => {
  assert.equal(deriveRepeatPersonSeverity(10), "HIGH");
});

test("NEW_NETWORK_CONNECTION is always NOTICE, never HIGH by itself", () => {
  assert.equal(deriveNewNetworkConnectionSeverity(), "NOTICE");
});

test("HIGH_CONFIDENCE_DUPLICATE is always HIGH", () => {
  assert.equal(deriveHighConfidenceDuplicateSeverity(), "HIGH");
});

test("severity functions are pure — same input always produces the same output", () => {
  assert.equal(deriveRepeatEntitySeverity(3, 2), deriveRepeatEntitySeverity(3, 2));
  assert.equal(deriveRepeatPersonSeverity(4), deriveRepeatPersonSeverity(4));
});
