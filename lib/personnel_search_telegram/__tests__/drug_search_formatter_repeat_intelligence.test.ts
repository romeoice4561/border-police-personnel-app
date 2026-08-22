/**
 * Regression tests for the DI-6 Section 16 minimal Telegram enhancement —
 * the "⚠ พบข้อมูลนี้ในหลายคดี" repeat-intelligence line added to
 * drug_search_formatter.ts's per-entity detail formatters.
 *
 * This is presentation-only: `result.caseCount` was already computed by
 * DrugIntelligenceSearchService (DI-3) before this line existed, so these
 * tests exercise the formatter functions directly with hand-built
 * DrugSearchResult fixtures — no case seeding, no dispatcher, no database —
 * matching this module's existing "formatter safety" test style (see
 * drug_search_telegram.test.ts's own formatter-only assertions).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatDrugPersonDetailText,
  formatDrugPhoneDetailText,
  formatDrugSimDetailText,
  formatDrugDeviceDetailText,
  formatDrugVehicleDetailText,
  formatDrugCaseDetailText,
} from "@/lib/personnel_search_telegram/drug_search_formatter";
import type { DrugSearchResult } from "@/lib/drug_intelligence/drug_search_types";

const REPEAT_MARKER = "⚠ พบข้อมูลนี้ในหลายคดี";

function baseResult(overrides: Partial<DrugSearchResult> = {}): DrugSearchResult {
  return {
    entityType: "PHONE",
    entityId: "entity-1",
    primaryLabel: "081-234-5678",
    secondaryLabel: null,
    matchedField: "PHONE_NUMBER",
    matchedValueMasked: "081-234-5678",
    strength: "EXACT",
    firstSeen: new Date("2026-01-01"),
    lastSeen: new Date("2026-06-01"),
    caseCount: 1,
    hasPotentialDuplicate: null,
    canonicalTarget: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// 1. Repeat intelligence is shown only when the threshold is satisfied
//    (caseCount > 1 — i.e. found in more than one case).

test("PHONE: caseCount=1 (single-use) never shows the repeat-intelligence line — no false-positive noise", () => {
  const text = formatDrugPhoneDetailText(baseResult({ entityType: "PHONE", caseCount: 1 }));
  assert.ok(!text.includes(REPEAT_MARKER), `expected no repeat marker for a single-case phone, got:\n${text}`);
});

test("PHONE: caseCount=2 (found in 2 cases) DOES show the repeat-intelligence line", () => {
  const text = formatDrugPhoneDetailText(baseResult({ entityType: "PHONE", caseCount: 2 }));
  assert.ok(text.includes(REPEAT_MARKER), `expected the repeat marker for a 2-case phone, got:\n${text}`);
});

test("PHONE: caseCount=0 (should not normally occur, but must not throw or show a nonsensical warning) never shows the repeat line", () => {
  const text = formatDrugPhoneDetailText(baseResult({ entityType: "PHONE", caseCount: 0 }));
  assert.ok(!text.includes(REPEAT_MARKER));
});

// ---------------------------------------------------------------------
// 2. A normal single-use entity never receives a misleading repeat warning
//    — repeated across every entity-type formatter that supports it.

test("PERSON: single-case person never shows the repeat line", () => {
  const text = formatDrugPersonDetailText(baseResult({ entityType: "PERSON", primaryLabel: "นาย ทดสอบ หนึ่ง", caseCount: 1 }));
  assert.ok(!text.includes(REPEAT_MARKER));
});

test("PERSON: multi-case person (e.g. Person A: QA-001 + QA-003 = 2 cases) shows the repeat line", () => {
  const text = formatDrugPersonDetailText(baseResult({ entityType: "PERSON", primaryLabel: "นาย ทดสอบ หนึ่ง", caseCount: 2 }));
  assert.ok(text.includes(REPEAT_MARKER));
});

test("SIM: single-case SIM never shows the repeat line; multi-case SIM does", () => {
  const single = formatDrugSimDetailText(baseResult({ entityType: "SIM", primaryLabel: "QA-SIM-0001", caseCount: 1 }));
  const multi = formatDrugSimDetailText(baseResult({ entityType: "SIM", primaryLabel: "QA-SIM-0001", caseCount: 3 }));
  assert.ok(!single.includes(REPEAT_MARKER));
  assert.ok(multi.includes(REPEAT_MARKER));
});

test("DEVICE: single-case device never shows the repeat line; multi-case device does (mirrors B/C shared IMEI 990000000000002)", () => {
  const single = formatDrugDeviceDetailText(baseResult({ entityType: "DEVICE", primaryLabel: "990000000000002", caseCount: 1 }));
  const multi = formatDrugDeviceDetailText(baseResult({ entityType: "DEVICE", primaryLabel: "990000000000002", caseCount: 2 }));
  assert.ok(!single.includes(REPEAT_MARKER));
  assert.ok(multi.includes(REPEAT_MARKER));
});

test("VEHICLE: single-case vehicle never shows the repeat line; multi-case vehicle does (mirrors A/D shared QA-1001)", () => {
  const single = formatDrugVehicleDetailText(baseResult({ entityType: "VEHICLE", primaryLabel: "QA-1001", caseCount: 1 }));
  const multi = formatDrugVehicleDetailText(baseResult({ entityType: "VEHICLE", primaryLabel: "QA-1001", caseCount: 2 }));
  assert.ok(!single.includes(REPEAT_MARKER));
  assert.ok(multi.includes(REPEAT_MARKER));
});

test("CASE results never show the repeat-intelligence line — a case does not repeat 'within' itself, the concept is not meaningful for this entity type", () => {
  const text = formatDrugCaseDetailText(baseResult({ entityType: "CASE", primaryLabel: "QA-001", caseCount: 1 }));
  assert.ok(!text.includes(REPEAT_MARKER));
});

// ---------------------------------------------------------------------
// 3/4/5. Does not expose full alert history, does not break masking, and
// stays a single short line — never a dump of prior case numbers/ids/
// person names beyond what the existing (pre-DI-6) formatter already showed.

test("the repeat line never contains a case id, case number, or person name — only the fixed neutral marker text", () => {
  const text = formatDrugPhoneDetailText(baseResult({ entityType: "PHONE", caseCount: 5 }));
  assert.ok(text.includes(REPEAT_MARKER));
  // Nothing beyond the formatter's own already-existing fields (primaryLabel, caseCount, first/last seen) appears.
  assert.ok(!/QA-\d{3}/.test(text), "must never leak a specific case number into the repeat-intelligence line itself");
});

test("masking is untouched — formatter still only renders result.primaryLabel exactly as given (masking happens upstream in the search service, per this module's existing contract)", () => {
  const masked = baseResult({ entityType: "PHONE", primaryLabel: "081-xxx-5678", caseCount: 3 });
  const text = formatDrugPhoneDetailText(masked);
  assert.ok(text.includes("081-xxx-5678"), "the repeat-intelligence addition must not alter or re-derive the already-masked label");
  assert.ok(!text.includes("081-234-5678"), "must never accidentally unmask by reconstructing the raw value");
});

test("the repeat-intelligence line is a single line — never multiple lines or a history dump", () => {
  const text = formatDrugPhoneDetailText(baseResult({ entityType: "PHONE", caseCount: 10 }));
  const repeatLineCount = text.split("\n").filter((line) => line.includes(REPEAT_MARKER)).length;
  assert.equal(repeatLineCount, 1);
});
