/**
 * DI-8.7 V1.5B VISUAL HOTFIX (Section 7/14.E) — Case Detail page-level
 * wiring for the contextual temporal-focus return.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const pageSource = readFileSync(join(ROOT, "app/drug-intelligence/cases/[id]/page.tsx"), "utf8");

test("Case Detail imports isTemporalFocusReturnTo and the shared temporal label composer", () => {
  assert.match(pageSource, /isTemporalFocusReturnTo/);
  assert.match(pageSource, /composeTemporalSelectionLabel/);
  assert.match(pageSource, /parseTemporalSelectionFromParams/);
});

test("temporalReturnLabel is only computed when returnTo actually carries temporal-focus context (never fabricated for ordinary Network returnTo)", () => {
  const block = pageSource.match(/const temporalReturnLabel =\s*\n\s*returnTo && isTemporalFocusReturnTo\(returnTo\)/);
  assert.ok(block, "temporalReturnLabel must be gated on isTemporalFocusReturnTo(returnTo)");
});

test("temporalReturnLabel is rendered as secondary text only when non-null, using the real query params already present in returnTo", () => {
  assert.match(pageSource, /\{temporalReturnLabel \? \(/);
  assert.match(pageSource, /data-testid="temporal-return-context-label"/);
});

test("the ordinary back button still uses returnToBackLabelKey(returnTo) unconditionally — the contextual label only supplements it, never replaces the mechanism", () => {
  assert.match(pageSource, /\{t\(returnToBackLabelKey\(returnTo\)\)\}/);
});

test("Case Detail's primary Network navigation link and every case-scoped returnTo still use withReturnTo(..., returnTo) unchanged — this hotfix does not rewrite ordinary navigation", () => {
  const withReturnToUsages = pageSource.match(/withReturnTo\(/g) ?? [];
  assert.ok(withReturnToUsages.length >= 3, "withReturnTo must still be used at its existing call sites");
});
