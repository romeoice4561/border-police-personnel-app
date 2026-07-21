import { test } from "node:test";
import assert from "node:assert/strict";

import { checkAiCallBudget, DEFAULT_AI_USAGE_POLICY, type AiCallHistory } from "@/lib/extraction/budget_policy";

function noUsage(): AiCallHistory {
  return { callsForThisDocument: 0, callsToday: 0, callsThisMonth: 0, callsTodayForThisUser: 0 };
}

test("default policy: automaticFallbackAllowed is OFF", () => {
  assert.equal(DEFAULT_AI_USAGE_POLICY.automaticFallbackAllowed, false);
});

test("default policy: requireUserConfirmation is ON", () => {
  assert.equal(DEFAULT_AI_USAGE_POLICY.requireUserConfirmation, true);
});

test("default policy: maxAiCallsPerDocument is 1", () => {
  assert.equal(DEFAULT_AI_USAGE_POLICY.maxAiCallsPerDocument, 1);
});

test("default policy: maxAutomaticRetries is 0", () => {
  assert.equal(DEFAULT_AI_USAGE_POLICY.maxAutomaticRetries, 0);
});

test("default policy: duplicateReprocessingAllowed is OFF", () => {
  assert.equal(DEFAULT_AI_USAGE_POLICY.duplicateReprocessingAllowed, false);
});

test("checkAiCallBudget: allows the first call under default policy", () => {
  const result = checkAiCallBudget(DEFAULT_AI_USAGE_POLICY, noUsage());
  assert.equal(result.allowed, true);
});

test("checkAiCallBudget: blocks a second call for the same document (max 1 per document)", () => {
  const result = checkAiCallBudget(DEFAULT_AI_USAGE_POLICY, { ...noUsage(), callsForThisDocument: 1 });
  assert.equal(result.allowed, false);
});

test("checkAiCallBudget: blocks when aiFallbackEnabled is false", () => {
  const result = checkAiCallBudget({ ...DEFAULT_AI_USAGE_POLICY, aiFallbackEnabled: false }, noUsage());
  assert.equal(result.allowed, false);
});

test("checkAiCallBudget: respects a configured daily limit", () => {
  const policy = { ...DEFAULT_AI_USAGE_POLICY, dailyCallLimit: 10 };
  assert.equal(checkAiCallBudget(policy, { ...noUsage(), callsToday: 9 }).allowed, true);
  assert.equal(checkAiCallBudget(policy, { ...noUsage(), callsToday: 10 }).allowed, false);
});

test("checkAiCallBudget: respects a configured monthly limit", () => {
  const policy = { ...DEFAULT_AI_USAGE_POLICY, monthlyCallLimit: 100 };
  assert.equal(checkAiCallBudget(policy, { ...noUsage(), callsThisMonth: 100 }).allowed, false);
});

test("checkAiCallBudget: respects a configured per-user daily limit", () => {
  const policy = { ...DEFAULT_AI_USAGE_POLICY, perUserDailyLimit: 5 };
  assert.equal(checkAiCallBudget(policy, { ...noUsage(), callsTodayForThisUser: 5 }).allowed, false);
});

test("checkAiCallBudget: null limits mean unlimited (not configured)", () => {
  const policy = { ...DEFAULT_AI_USAGE_POLICY, dailyCallLimit: null, monthlyCallLimit: null, perUserDailyLimit: null };
  const result = checkAiCallBudget(policy, { ...noUsage(), callsToday: 999999, callsThisMonth: 999999 });
  assert.equal(result.allowed, true);
});

test("checkAiCallBudget: unsupportedDocumentTypes default list is non-empty (a real configured set, not accidentally empty)", () => {
  assert.ok(DEFAULT_AI_USAGE_POLICY.supportedDocumentTypes.length > 0);
});

test("checkAiCallBudget: maxFileSizeBytes never exceeds the existing document upload limit (10MB)", () => {
  assert.ok(DEFAULT_AI_USAGE_POLICY.maxFileSizeBytes <= 10 * 1024 * 1024);
});

test("checkAiCallBudget: maxPageCount defaults to 5 per spec §16", () => {
  assert.equal(DEFAULT_AI_USAGE_POLICY.maxPageCount, 5);
});
