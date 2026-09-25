/**
 * DI-8.7 V1.5B VISUAL HOTFIX ROUND 3 — regression tests for the actual
 * runtime lifecycle bug: the Network page's temporal-focus restoration
 * request was silently skipped when the page component instance was
 * reused across a same-route (Case Detail -> Network) navigation,
 * because the original guard was a one-shot boolean tied to the
 * component's lifetime rather than to the restore request itself.
 *
 * shouldAttemptTemporalRestore is the pure decision function extracted
 * from that effect specifically so this lifecycle is testable without a
 * React rendering harness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldAttemptTemporalRestore } from "../drug_temporal_explorer.js";

// Reproduces the exact round-2 bug scenario, step by step.
test("REGRESSION: a NEW restore request (tFocus=1) after a PRIOR unrelated request was already consumed (page instance reused) is still attempted", () => {
  // Step 1: initial page load, no tFocus present at all — consumed immediately, non-request.
  const firstLoad = shouldAttemptTemporalRestore({
    restoreKey: "focusType=PERSON&focusId=p1&depth=2",
    lastAttemptedRestoreKey: null,
    hasNeighborhoodData: true,
    isRestoreRequest: false,
  });
  assert.deepEqual(firstLoad, { attempt: false, consumeKey: true });
  const afterFirstLoad = "focusType=PERSON&focusId=p1&depth=2"; // what the ref would now hold

  // Step 2: user does Crime Clock -> ดูบนผัง -> opens DI-TEST-001 -> เปิดคดี ->
  // กลับไปดูคดีตามช่วงเวลา — SAME page component instance, but a genuinely
  // NEW restoreKey (now carrying tFocus=1 + temporal params).
  const returnTrip = shouldAttemptTemporalRestore({
    restoreKey: "focusType=PERSON&focusId=p1&depth=2&tStart=1080&tEnd=1440&tFocus=1",
    lastAttemptedRestoreKey: afterFirstLoad,
    hasNeighborhoodData: true,
    isRestoreRequest: true,
  });
  // THE BUG: a boolean-ref implementation would have returned false here
  // (guard already consumed by the first, unrelated load). The fix must
  // attempt it, because this is a DIFFERENT, new restore key.
  assert.deepEqual(returnTrip, { attempt: true, consumeKey: true });
});

// A. tFocus=1 exists, valid params exist, neighborhood NOT ready yet.
test("A. a real restore request with neighborhood not yet loaded does not attempt AND does not consume the key (retries later)", () => {
  const decision = shouldAttemptTemporalRestore({
    restoreKey: "tStart=1080&tEnd=1440&tFocus=1",
    lastAttemptedRestoreKey: null,
    hasNeighborhoodData: false,
    isRestoreRequest: true,
  });
  assert.deepEqual(decision, { attempt: false, consumeKey: false });
});

// B. Same request, neighborhood becomes available on a later render.
test("B. the SAME restore key, once neighborhood becomes available, is now attempted (the key was never consumed while pending)", () => {
  const pending = shouldAttemptTemporalRestore({
    restoreKey: "tStart=1080&tEnd=1440&tFocus=1",
    lastAttemptedRestoreKey: null,
    hasNeighborhoodData: false,
    isRestoreRequest: true,
  });
  assert.equal(pending.consumeKey, false);
  // Ref still null (never consumed) — simulate the next render with data ready.
  const ready = shouldAttemptTemporalRestore({
    restoreKey: "tStart=1080&tEnd=1440&tFocus=1",
    lastAttemptedRestoreKey: null, // unchanged, since pending.consumeKey was false
    hasNeighborhoodData: true,
    isRestoreRequest: true,
  });
  assert.deepEqual(ready, { attempt: true, consumeKey: true });
});

// Data already available on the first eligible render.
test("data already available on the first eligible render: attempts immediately, consumes the key", () => {
  const decision = shouldAttemptTemporalRestore({
    restoreKey: "tStart=1080&tEnd=1440&tFocus=1",
    lastAttemptedRestoreKey: null,
    hasNeighborhoodData: true,
    isRestoreRequest: true,
  });
  assert.deepEqual(decision, { attempt: true, consumeKey: true });
});

// Restoration does not loop on unrelated renders (same key, already attempted).
test("restoration does not loop on unrelated re-renders — the same already-attempted key is never re-attempted", () => {
  const key = "tStart=1080&tEnd=1440&tFocus=1";
  const first = shouldAttemptTemporalRestore({ restoreKey: key, lastAttemptedRestoreKey: null, hasNeighborhoodData: true, isRestoreRequest: true });
  assert.equal(first.attempt, true);
  const second = shouldAttemptTemporalRestore({ restoreKey: key, lastAttemptedRestoreKey: key, hasNeighborhoodData: true, isRestoreRequest: true });
  assert.deepEqual(second, { attempt: false, consumeKey: false });
});

// Not a restore request at all (ordinary Network navigation, no tFocus).
test("a non-restore-request URL (no tFocus) is never attempted, and is consumed immediately regardless of neighborhood readiness", () => {
  const withoutData = shouldAttemptTemporalRestore({
    restoreKey: "focusType=CASE&focusId=c1",
    lastAttemptedRestoreKey: null,
    hasNeighborhoodData: false,
    isRestoreRequest: false,
  });
  assert.deepEqual(withoutData, { attempt: false, consumeKey: true });
});

// Malformed temporal params (isRestoreRequest can still be true even if the eventual parsed selection is empty — that's handled by the caller via isEffectiveTemporalNarrowing, not this predicate).
test("the predicate itself is agnostic to whether the eventual parsed selection is effective — that check happens in the caller after attempt=true", () => {
  const decision = shouldAttemptTemporalRestore({
    restoreKey: "tFocus=1", // tFocus=1 present, but no actual date/weekday/time params
    lastAttemptedRestoreKey: null,
    hasNeighborhoodData: true,
    isRestoreRequest: true,
  });
  assert.deepEqual(decision, { attempt: true, consumeKey: true });
});
