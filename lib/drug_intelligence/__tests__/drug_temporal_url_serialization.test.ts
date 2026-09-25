/**
 * DI-8.7 V1.5B VISUAL HOTFIX — TemporalSelection <-> URL query param
 * round-tripping, used to preserve Crime Clock / Temporal Graph Focus
 * context through a Case Detail navigation and back (Section 6/14.C/D).
 *
 * Pure-engine tests only — page-level wiring (temporalAwareReturnPath,
 * the restoration effect, the remembered-context lifecycle) is covered
 * by drug_temporal_graph_focus_return_context.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serializeTemporalSelectionParams,
  parseTemporalSelectionFromParams,
  shouldRestoreTemporalGraphFocus,
  composeTemporalSelectionLabel,
  emptyTemporalSelection,
  type TemporalSelection,
} from "../drug_temporal_explorer.js";

function paramsFrom(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

// C. temporal returnTo serialization is deterministic.
test("C1. serializeTemporalSelectionParams encodes dateFrom/dateTo/weekday/startMinute/endMinute under distinct t-prefixed keys", () => {
  const selection: TemporalSelection = {
    dataset: "ARREST_TIME",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-30",
    weekday: 6,
    startMinute: 18 * 60,
    endMinute: 0,
  };
  const params = serializeTemporalSelectionParams(selection);
  assert.deepEqual(params, {
    tDateFrom: "2026-09-01",
    tDateTo: "2026-09-30",
    tWeekday: "6",
    tStart: "1080",
    tEnd: "0",
  });
});
test("C2. serializeTemporalSelectionParams omits fields that are not set — never fabricates a filter", () => {
  const params = serializeTemporalSelectionParams(emptyTemporalSelection());
  assert.deepEqual(params, {});
});
test("C3. serializeTemporalSelectionParams with focusActive:true adds the tFocus=1 restoration flag", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 0, endMinute: 60 };
  const params = serializeTemporalSelectionParams(selection, { focusActive: true });
  assert.equal(params.tFocus, "1");
});
test("C4. serializeTemporalSelectionParams without focusActive never includes tFocus", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 0, endMinute: 60 };
  const params = serializeTemporalSelectionParams(selection);
  assert.equal(params.tFocus, undefined);
});

// D. temporal return restoration — parsed selection equals original.
test("D1. parseTemporalSelectionFromParams is the exact inverse of serializeTemporalSelectionParams for a full selection", () => {
  const original: TemporalSelection = {
    dataset: "ARREST_TIME",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-30",
    weekday: 6,
    startMinute: 18 * 60,
    endMinute: 0,
  };
  const params = paramsFrom(serializeTemporalSelectionParams(original));
  const parsed = parseTemporalSelectionFromParams(params);
  assert.deepEqual(parsed, original);
});
test("D2. an empty params object parses back to an empty selection (all fields undefined)", () => {
  const parsed = parseTemporalSelectionFromParams(paramsFrom({}));
  assert.deepEqual(parsed, emptyTemporalSelection());
});
test("D3. invalid/malformed param values are safely ignored, never fabricated into a selection field", () => {
  const parsed = parseTemporalSelectionFromParams(
    paramsFrom({ tDateFrom: "not-a-date", tWeekday: "9", tStart: "abc" }),
  );
  assert.deepEqual(parsed, emptyTemporalSelection());
});
test("D4. a time range is only restored when BOTH tStart and tEnd are present and valid — never a partial/broken filter", () => {
  const parsed = parseTemporalSelectionFromParams(paramsFrom({ tStart: "1080" }));
  assert.equal(parsed.startMinute, undefined);
  assert.equal(parsed.endMinute, undefined);
});

// G. Midnight-wrap return state round-trips correctly.
test("G. a midnight-wrap selection (22:00-01:00, i.e. startMinute > endMinute) round-trips exactly through URL params", () => {
  const original: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 22 * 60, endMinute: 60 };
  const parsed = parseTemporalSelectionFromParams(paramsFrom(serializeTemporalSelectionParams(original)));
  assert.equal(parsed.startMinute, 22 * 60);
  assert.equal(parsed.endMinute, 60);
});
test("G2. an 18:00-00:00 selection (endMinute=1440, the exact acceptance-flow example) round-trips exactly", () => {
  const original: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 18 * 60, endMinute: 24 * 60 };
  const parsed = parseTemporalSelectionFromParams(paramsFrom(serializeTemporalSelectionParams(original)));
  assert.equal(parsed.startMinute, 18 * 60);
  assert.equal(parsed.endMinute, 24 * 60);
});

// shouldRestoreTemporalGraphFocus flag detection.
test("shouldRestoreTemporalGraphFocus is true only when tFocus=1 is present, false for tFocus=0/absent/other", () => {
  assert.equal(shouldRestoreTemporalGraphFocus(paramsFrom({ tFocus: "1" })), true);
  assert.equal(shouldRestoreTemporalGraphFocus(paramsFrom({ tFocus: "0" })), false);
  assert.equal(shouldRestoreTemporalGraphFocus(paramsFrom({})), false);
  assert.equal(shouldRestoreTemporalGraphFocus(paramsFrom({ tFocus: "true" })), false);
});

// composeTemporalSelectionLabel — the ONE shared label composer.
function fakeT(key: string): string {
  const dict: Record<string, string> = {
    "di.temporal.dateFrom": "ตั้งแต่วันที่",
    "di.temporal.dateTo": "ถึงวันที่",
    "di.temporal.selectedRangeNone": "ทั้ง 24 ชั่วโมง",
  };
  return dict[key] ?? key;
}
function fakeFormatDate(v: string): string {
  return v; // identity — this test only checks composition structure, not Thai date formatting itself
}

test("composeTemporalSelectionLabel returns the empty-selection copy for a fully empty selection", () => {
  assert.equal(composeTemporalSelectionLabel(emptyTemporalSelection(), fakeT, fakeFormatDate), "ทั้ง 24 ชั่วโมง");
});
test("composeTemporalSelectionLabel composes date + weekday + time with a middle-dot separator, in that order", () => {
  const selection: TemporalSelection = {
    dataset: "ARREST_TIME",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-01",
    weekday: 6,
    startMinute: 18 * 60,
    endMinute: 24 * 60,
  };
  const label = composeTemporalSelectionLabel(selection, fakeT, fakeFormatDate);
  assert.equal(label, "2026-09-01 · วันเสาร์ · 18:00–00:00 น.");
});
test("composeTemporalSelectionLabel with only a time range omits date/weekday parts entirely (never fabricated)", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 18 * 60, endMinute: 24 * 60 };
  const label = composeTemporalSelectionLabel(selection, fakeT, fakeFormatDate);
  assert.equal(label, "18:00–00:00 น.");
});
