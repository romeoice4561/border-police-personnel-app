/**
 * DI-8.7 V1.5B — Temporal Cross-View Intelligence: page-level wiring
 * contract tests (Section 18 items Q, R, S, U, V) — source-level checks
 * proving the Network page actually reuses the existing DI-8.4/DI-8.7
 * camera+emphasis contract for the new temporal graph focus, that
 * activation/clearing precedence between temporal/insight/path focus is
 * unambiguous, and that no risk/suspicion language was introduced.
 *
 * The pure subgraph-derivation rule itself (items A-I) is covered by
 * drug_temporal_graph_focus.test.ts; the Crime Clock visual-selection
 * polish (item T) and histogram sync (item U) are covered here via
 * source inspection of the clock/histogram components.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const clockSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_crime_clock.tsx"), "utf8");
const histogramSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_crime_clock_histogram.tsx"), "utf8");
const panelSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_temporal_explorer_panel.tsx"), "utf8");

// Q. Temporal focus uses the existing camera/emphasis contract — no second engine.
// VISUAL HOTFIX update: temporal focus no longer rides the emphasizedPath/
// selectedSecondaryId mechanism (that required a fabricated node selection,
// which auto-opened the Inspector — see Section 1/2 of the hotfix). It now
// drives the dedicated presentationFocus extension on buildDrugNetworkFlowGraph
// instead, which needs no selection at all. Camera reuse (Q2) is unchanged.
test("Q1. activeTemporalFocus composes into the presentationFocus prop the flow adapter's dedicated no-selection-required extension accepts", () => {
  assert.match(pageSource, /presentationFocus:\s*activeTemporalFocus\s*\n?\s*\?\s*\{\s*nodeIds:\s*activeTemporalFocus\.nodeIds,\s*edgeIds:\s*activeTemporalFocus\.edgeIds\s*\}\s*\n?\s*:\s*null,/);
});
test("Q2. the temporal camera-fit effect reuses collectPathFitNodes/computeSelectedPathFocusViewport/setViewport verbatim — same primitives as the DI-8.4/DI-8.7-V1 camera effects", () => {
  const temporalEffect = pageSource.match(/DI-8\.7 V1\.5B — camera\/viewport only[\s\S]{0,2200}?\}, \[neighborhood\.data, activeTemporalFocus, setViewport\]\);/);
  assert.ok(temporalEffect, "could not locate the temporal camera-fit effect");
  assert.match(temporalEffect![0], /collectPathFitNodes/);
  assert.match(temporalEffect![0], /computeSelectedPathFocusViewport/);
  assert.match(temporalEffect![0], /setViewport\(viewport/);
});
test("Q3. the flow adapter itself (not the page) derives isolate/emphasize behavior from presentationFocus — the page passes the raw focus set through unconditionally", () => {
  const adapterSource = readFileSync(path.join(dir, "..", "drug_network_graph_flow_adapter.ts"), "utf8");
  assert.match(adapterSource, /const hasPresentationFocus = Boolean\(presentationFocus/);
  assert.match(adapterSource, /compareEmphasize \|\| arrangementIsolatesPath \|\| selectedGraphEdge \|\| emphasizeSelectedPath \|\| hasPresentationFocus/);
});
test("Q4. the temporal graph focus is derived purely from computeTemporalGraphFocus (the pure engine) — the page never re-implements subgraph derivation inline", () => {
  assert.match(panelSource, /computeTemporalGraphFocus\(\{/);
  assert.doesNotMatch(pageSource, /matchingCaseIdSet\.has\(edge\.source\)/, "the page must not reimplement the subgraph-derivation loop itself");
});

/** Slices pageSource between the start of a handler declaration and the start of the NEXT top-level `const`/`function` declaration at the same low indentation, as a CRLF-tolerant way to isolate one handler's body without hardcoding its exact closing punctuation. */
function extractBlock(startMarker: string, source: string, maxLen = 1800): string {
  const startIndex = source.indexOf(startMarker);
  assert.ok(startIndex !== -1, `could not locate marker: ${startMarker}`);
  return source.slice(startIndex, startIndex + maxLen);
}

// R. Activating temporal focus clears incompatible insight/path focus, and vice versa.
test("R1. handleTemporalViewOnGraph clears activeInsightFocus before setting activeTemporalFocus", () => {
  const handler = extractBlock("const handleTemporalViewOnGraph = useCallback(", pageSource, 2400);
  const setInsightNullIndex = handler.indexOf("setActiveInsightFocus(null)");
  const setTemporalIndex = handler.indexOf("setActiveTemporalFocus(focus)");
  assert.ok(setInsightNullIndex !== -1 && setTemporalIndex !== -1 && setInsightNullIndex < setTemporalIndex);
});
test("R2. handleInsightViewOnGraph clears activeTemporalFocus before setting activeInsightFocus", () => {
  const handler = extractBlock("const handleInsightViewOnGraph = useCallback(", pageSource);
  const setTemporalNullIndex = handler.indexOf("setActiveTemporalFocus(null)");
  const setInsightIndex = handler.indexOf("setActiveInsightFocus({");
  assert.ok(setTemporalNullIndex !== -1 && setInsightIndex !== -1 && setTemporalNullIndex < setInsightIndex);
});
test("R3. an ordinary (non-focus-activating) selectedSecondaryId change clears BOTH activeInsightFocus and activeTemporalFocus in the same effect", () => {
  const effect = extractBlock("useEffect(() => {\r\n    setSelectedPathIndex(0);", pageSource, 1300);
  assert.match(effect, /setActiveInsightFocus\(null\)/);
  assert.match(effect, /setActiveTemporalFocus\(null\)/);
  assert.match(effect, /skipNextFocusClearRef/);
});
// R4 (VISUAL HOTFIX update): handleInsightViewOnGraph still selects a real
// node (insight focus is unchanged by this hotfix, per explicit scope).
// handleTemporalViewOnGraph no longer selects any node — it now guards its
// own setSelectedNode(null) call instead (see drug_temporal_graph_focus_no_inspector.test.ts
// item B/C for the "no fabricated selection" contract this hotfix adds).
test("R4. handleInsightViewOnGraph sets skipNextFocusClearRef before calling setSelectedNode(nodeToSelect); handleTemporalViewOnGraph sets it before calling setSelectedNode(null)", () => {
  const insightHandler = extractBlock("const handleInsightViewOnGraph = useCallback(", pageSource);
  const temporalHandler = extractBlock("const handleTemporalViewOnGraph = useCallback(", pageSource, 2400);
  const insightGuardIndex = insightHandler.indexOf("skipNextFocusClearRef.current = true");
  const insightSelectIndex = insightHandler.indexOf("setSelectedNode(nodeToSelect)");
  assert.ok(insightGuardIndex !== -1 && insightSelectIndex !== -1 && insightGuardIndex < insightSelectIndex, "insight handler must set the guard before setSelectedNode(nodeToSelect)");
  const temporalGuardIndex = temporalHandler.indexOf("skipNextFocusClearRef.current = true");
  const temporalSelectIndex = temporalHandler.indexOf("setSelectedNode(null)");
  assert.ok(temporalGuardIndex !== -1 && temporalSelectIndex !== -1 && temporalGuardIndex < temporalSelectIndex, "temporal handler must set the guard before setSelectedNode(null)");
});

// S. Restore full network clears temporal focus (same as it clears insight focus).
test("S. applyPathCameraMode('FULL_NETWORK') clears both activeInsightFocus and activeTemporalFocus", () => {
  const fullNetworkBranch = extractBlock('if (mode === "FULL_NETWORK") {', pageSource, 700);
  assert.match(fullNetworkBranch, /setActiveInsightFocus\(null\)/);
  assert.match(fullNetworkBranch, /setActiveTemporalFocus\(null\)/);
});
test("S2. the temporal focus banner's 'ดูทั้งเครือข่าย' action reuses applyPathCameraMode('FULL_NETWORK') — no separate reset control", () => {
  assert.match(pageSource, /applyPathCameraMode\("FULL_NETWORK"\)\}\s*data-testid="temporal-focus-full-network"/);
});

// T. Crime Clock selection visual treatment no longer uses strong per-segment white selection borders.
test("T1. individual hour segments in the clock use a single subtle stroke class regardless of selection state — no per-segment stroke-foreground/thick stroke toggle", () => {
  assert.doesNotMatch(clockSource, /isSelected \? "stroke-foreground" : "stroke-surface"/);
  assert.doesNotMatch(clockSource, /strokeWidth=\{isSelected \? 2\.5 : 1\}/);
});
test("T2. selection is instead rendered as a single outer selection arc, drawn once per contiguous selected run, not per segment", () => {
  assert.match(clockSource, /function selectionArcPaths/);
  assert.match(clockSource, /crime-clock-selection-arc/);
});
test("T3. the histogram no longer wraps every selected bar in a full ring — selection uses a border-bottom + soft tint instead", () => {
  assert.doesNotMatch(histogramSource, /ring-1 ring-foreground/);
  assert.match(histogramSource, /border-foreground/);
});

// U. Histogram selection remains synchronized with the clock (same hoursInRange helper, same onSelectRange -> setSelection wiring) — re-verified after the visual polish changes.
test("U. the histogram still imports hoursInRange from the clock component and still calls the shared onSelectRange callback", () => {
  assert.match(histogramSource, /import \{ hoursInRange \} from ["']@\/components\/drug_intelligence\/drug_crime_clock["']/);
  assert.match(histogramSource, /onSelectRange\(/);
});

// V. No risk/suspicion/criminal-inference language anywhere in the new files.
test("V. no risk/suspicion/criminal-inference language in the new V1.5B source files", () => {
  const forbidden = [
    "ช่วงเวลาเสี่ยง",
    "เวลาที่ผู้ต้องหามักก่อเหตุ",
    "ช่วงอันตราย",
    "พฤติกรรมต้องสงสัย",
    "แนวโน้มก่อเหตุ",
  ];
  const files = [
    ["page.tsx (temporal sections)", pageSource],
    ["drug_temporal_explorer_panel.tsx", panelSource],
    ["drug_crime_clock.tsx", clockSource],
    ["drug_crime_clock_histogram.tsx", histogramSource],
  ] as const;
  for (const [name, src] of files) {
    for (const term of forbidden) {
      assert.doesNotMatch(src, new RegExp(term), `${name} must not contain "${term}"`);
    }
  }
});
