/**
 * DI-8.7 V1.5B VISUAL HOTFIX (Section 7/14.E) — Case Detail's contextual
 * "back" label must distinguish a returnTo carrying Temporal Focus
 * context from ordinary Network navigation, without ever affecting any
 * other returnTo destination this module already classifies.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTemporalFocusReturnTo, returnToBackLabelKey } from "../return_to_back_label.js";

// E. Case Detail contextual return label.
test("E1. a Network returnTo with tFocus=1 is classified as a temporal-focus return", () => {
  assert.equal(isTemporalFocusReturnTo("/drug-intelligence/network?focusType=PERSON&focusId=p1&tFocus=1&tStart=1080&tEnd=0"), true);
});
test("E2. a plain Network returnTo (no tFocus) is NOT classified as a temporal-focus return", () => {
  assert.equal(isTemporalFocusReturnTo("/drug-intelligence/network?focusType=PERSON&focusId=p1"), false);
});
test("E3. tFocus=0 (or any value other than exactly '1') is not treated as active", () => {
  assert.equal(isTemporalFocusReturnTo("/drug-intelligence/network?tFocus=0"), false);
});
test("E4. a non-Network returnTo is never classified as temporal-focus even if it happens to contain tFocus=1", () => {
  assert.equal(isTemporalFocusReturnTo("/drug-intelligence/search?tFocus=1"), false);
});
test("E5. null/undefined returnTo is never classified as temporal-focus", () => {
  assert.equal(isTemporalFocusReturnTo(null), false);
  assert.equal(isTemporalFocusReturnTo(undefined), false);
});

test("E6. returnToBackLabelKey returns di.temporal.backToTemporalFocus for a temporal-focus Network returnTo", () => {
  assert.equal(returnToBackLabelKey("/drug-intelligence/network?focusType=PERSON&focusId=p1&tFocus=1"), "di.temporal.backToTemporalFocus");
});
test("E7. returnToBackLabelKey falls back to the existing ordinary-network label for a Network returnTo with no tFocus", () => {
  assert.equal(returnToBackLabelKey("/drug-intelligence/network?focusType=PERSON&focusId=p1"), "di.rel.backToNetwork");
});
test("E8. returnToBackLabelKey is unaffected for non-Network returnTo destinations (Link Compare, Search, Map, Timeline, Command, Person, Case)", () => {
  assert.equal(returnToBackLabelKey("/drug-intelligence/network/compare?a=1"), "di.linkCompare.backToCompare");
  assert.equal(returnToBackLabelKey("/drug-intelligence/search?q=x"), "di.rel.backToSearchResults");
  assert.equal(returnToBackLabelKey("/drug-intelligence/map"), "di.map.actionBackToMap");
  assert.equal(returnToBackLabelKey("/drug-intelligence/timeline?caseId=c1"), "di.rel.backToTimeline");
  assert.equal(returnToBackLabelKey("/drug-intelligence/command"), "di.command.backToDashboard");
  assert.equal(returnToBackLabelKey("/drug-intelligence/persons/p1"), "di.profile.backToPerson");
  assert.equal(returnToBackLabelKey("/drug-intelligence/cases/c1"), "di.rel.backToCase");
});
