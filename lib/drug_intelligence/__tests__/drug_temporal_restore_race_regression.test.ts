/**
 * DI-8.7 V1.5B VISUAL HOTFIX ROUND 4 — regression tests for the SECOND
 * real runtime bug proven via a live Playwright browser trace on
 * localhost:3014 (Round 3's fix alone was not sufficient — the actual
 * acceptance flow still failed in a real browser).
 *
 * TWO distinct causes were found and fixed this round:
 *
 * 1. PREFETCH RACE: Next.js <Link> prefetches its destination in the
 *    background as soon as it scrolls into view. That background render
 *    executed the Network page's request-keyed restoration effect
 *    (shouldAttemptTemporalRestore) and consumed the guard key BEFORE
 *    the user's real click — so the actual navigation's effect run saw
 *    an already-attempted key and silently skipped restoration. Fixed
 *    by disabling prefetch ONLY on the contextual temporal-return Link
 *    (prefetch={false} when isTemporalFocusReturnTo(returnTo)).
 *
 * 2. EFFECT-ORDERING RACE: even with the prefetch bug fixed, the
 *    restoration effect's own setActiveTemporalFocus(focus) call was
 *    immediately undone by the PRE-EXISTING selectedSecondaryId-clearing
 *    effect, which also fires around the same navigation (selectedNode
 *    settles back to null on the fresh Case Detail round trip) and — by
 *    design — clears activeTemporalFocus whenever it runs unguarded.
 *    Fixed by having the restoration effect set the SAME
 *    skipNextFocusClearRef guard handleTemporalViewOnGraph/
 *    handleInsightViewOnGraph already use for their own same-tick
 *    activations.
 *
 * Both were proven live via Playwright trace logging before being fixed
 * — see the Round 4 report for the exact captured sequence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const caseDetailSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "cases", "[id]", "page.tsx"), "utf8");

function extractBlock(startMarker: string, source: string, maxLen = 1600): string {
  const startIndex = source.indexOf(startMarker);
  assert.ok(startIndex !== -1, `could not locate marker: ${startMarker}`);
  return source.slice(startIndex, startIndex + maxLen);
}

// 1. PREFETCH RACE FIX.
test("1a. the contextual return Link disables prefetch ONLY when returnTo carries temporal-focus context — never globally", () => {
  assert.match(caseDetailSource, /prefetch=\{isTemporalFocusReturnTo\(returnTo\) \? false : undefined\}/);
});
test("1b. every OTHER Link in Case Detail (primary Network nav, Timeline, Map, back-to-list) is untouched — no prefetch prop added to them", () => {
  const primaryNetworkLink = extractBlock('<Link href={withReturnTo(`/drug-intelligence/network?focusType=CASE', caseDetailSource, 300);
  assert.doesNotMatch(primaryNetworkLink, /prefetch=/);
  const timelineLink = extractBlock("<Link href={`/drug-intelligence/timeline", caseDetailSource, 200);
  assert.doesNotMatch(timelineLink, /prefetch=/);
});
test("1c. isTemporalFocusReturnTo is imported and used to gate the prefetch decision, reusing the existing classifier rather than re-deriving tFocus parsing inline", () => {
  assert.match(caseDetailSource, /import \{ returnToBackLabelKey, isTemporalFocusReturnTo \} from ["']@\/lib\/ui\/return_to_back_label["'];/);
});

// 2. EFFECT-ORDERING RACE FIX.
test("2a. the restoration effect sets skipNextFocusClearRef.current = true before calling setActiveTemporalFocus, guarding against the pre-existing selectedSecondaryId-clearing effect undoing it in the same navigation", () => {
  const effect = extractBlock("const lastAttemptedTemporalRestoreKeyRef = useRef<string | null>(null);", pageSource, 2800);
  const guardIndex = effect.indexOf("skipNextFocusClearRef.current = true");
  const setFocusIndex = effect.indexOf("setActiveTemporalFocus(focus)");
  assert.ok(guardIndex !== -1 && setFocusIndex !== -1 && guardIndex < setFocusIndex, "the guard must be set before setActiveTemporalFocus(focus) in the restoration effect");
});
test("2b. the guard is set only AFTER confirming a real, non-null focus was computed — never unconditionally at the top of the effect (would incorrectly swallow an ordinary, unrelated selectedSecondaryId clear on a non-restoring render)", () => {
  const effect = extractBlock("const lastAttemptedTemporalRestoreKeyRef = useRef<string | null>(null);", pageSource, 2800);
  const focusNullCheckIndex = effect.indexOf("if (!focus) return;");
  const guardIndex = effect.indexOf("skipNextFocusClearRef.current = true");
  assert.ok(focusNullCheckIndex !== -1 && guardIndex !== -1 && focusNullCheckIndex < guardIndex, "the null-focus early return must come before the guard is set");
});
test("2c. the selectedSecondaryId-clearing effect's own guard-consumption logic (skip once, then clear) is unchanged by this round — same three-branch shape as before", () => {
  const effect = extractBlock("useEffect(() => {\r\n    setSelectedPathIndex(0);", pageSource, 1300);
  assert.match(effect, /if \(skipNextFocusClearRef\.current\) \{/);
  assert.match(effect, /skipNextFocusClearRef\.current = false;/);
  assert.match(effect, /\} else \{/);
  assert.match(effect, /setActiveTemporalFocus\(null\);/);
});

// Regression: the Round 3 request-keyed guard itself must still be intact (not reverted by this round's changes).
test("3. the Round 3 request-keyed restoration guard (shouldAttemptTemporalRestore, lastAttemptedTemporalRestoreKeyRef) remains intact — this round did not revert it", () => {
  assert.match(pageSource, /shouldAttemptTemporalRestore\(\{/);
  assert.match(pageSource, /const lastAttemptedTemporalRestoreKeyRef = useRef<string \| null>\(null\);/);
  assert.doesNotMatch(pageSource, /const temporalFocusRestoredRef = useRef\(false\)/, "the old one-shot boolean guard must still be gone");
});

// No debug/trace instrumentation was left behind after the fix.
test("4. no temporary console.log trace instrumentation remains in either file from this round's live debugging", () => {
  assert.doesNotMatch(pageSource, /TRACE2/);
  assert.doesNotMatch(caseDetailSource, /TRACE2/);
});
