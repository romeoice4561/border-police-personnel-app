/**
 * DI-8.5 — Regression: Hotspot Inspector / Area Temporal Panel "ดูความเชื่อมโยง"
 * links must use the Network Graph's real focus contract.
 *
 * app/drug-intelligence/network/page.tsx only reads focusType/focusId from
 * the URL. A previous version of the Hotspot Inspector linked with an
 * unsupported focusCaseId param, which the Network page silently ignored
 * (opening an unfocused graph instead of focusing the intended case).
 *
 * This is a static source-content check (no component-render harness exists
 * in this repo — see the pure-logic test convention elsewhere in this
 * directory), asserting the actual shipped href template rather than
 * re-deriving it, so a regression back to focusCaseId fails this test.
 *
 * Run:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_geo_hotspot_network_url.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

// N. Hotspot Network URL uses focusType=CASE / focusId=<id>
test("N: Hotspot Inspector's network link uses focusType=CASE&focusId=<caseId>", () => {
  const source = readSource("components/drug_intelligence/drug_geo_hotspot_inspector.tsx");
  assert.match(source, /\/drug-intelligence\/network\?focusType=CASE&focusId=\$\{encodeURIComponent\(row\.caseId\)\}/);
});

// O. Hotspot Network URL does NOT use focusCaseId
test("O: Hotspot Inspector's network link no longer builds an href with focusCaseId=", () => {
  const source = readSource("components/drug_intelligence/drug_geo_hotspot_inspector.tsx");
  assert.doesNotMatch(source, /href=\{`[^`]*focusCaseId=/);
});

test("Area Temporal pattern panel's network link also uses focusType=CASE&focusId=<caseId>, never focusCaseId", () => {
  const source = readSource("components/drug_intelligence/drug_geo_area_temporal_pattern_panel.tsx");
  assert.match(source, /\/drug-intelligence\/network\?focusType=CASE&focusId=/);
  assert.doesNotMatch(source, /href=\{`[^`]*focusCaseId=/);
});

// K. area filter action uses canonical applyFilters
// L. event action uses canonical filter state
// Both actions are wired as caller-supplied callbacks (onFilterProvince / onViewEvents)
// rather than a component-owned filter mechanism — asserted structurally: the panel
// takes no internal filter state and calls only the passed-in handlers.
test("K/L: the panel has no internal filter-state / fetch logic — actions call only the passed-in onFilterProvince/onViewEvents props", () => {
  const source = readSource("components/drug_intelligence/drug_geo_area_temporal_pattern_panel.tsx");
  assert.match(source, /onClick=\{\(\) => onFilterProvince\(pattern\.province\)\}/);
  assert.match(source, /onClick=\{\(\) => onViewEvents\(pattern\.province\)\}/);
  assert.doesNotMatch(source, /useState.*[Ff]ilter/, "no shadow filter state — the page's canonical applyFilters/DrugGeoFilterState remains the single source of truth");
});

// M. area does not imply direct relationship
test("M: the network action copy is the non-overclaiming 'เริ่มตรวจสอบความเชื่อมโยง', not 'ดูความเชื่อมโยง' (which would imply cases are already linked)", () => {
  const dictionarySource = readSource("lib/i18n/dictionary.ts");
  assert.match(dictionarySource, /"di\.map\.areaTemporalActionViewNetwork":\s*tr\("เริ่มตรวจสอบความเชื่อมโยง"/);
});
