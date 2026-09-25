/**
 * DI-8.7 V1.5B VISUAL HOTFIX — page-level source contract tests proving
 * that "ดูบนผัง" from the Crime Clock no longer fabricates a node
 * selection to obtain graph dimming (which previously auto-opened the
 * Inspector for one arbitrary matching case).
 *
 * Covers Section 12 items B, C, J, K, L, O, P (page-wiring side).
 * Items A, D-I, M, N (pure adapter behavior) are covered by
 * drug_network_presentation_focus.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");

function extractBlock(startMarker: string, source: string, maxLen = 1600): string {
  const startIndex = source.indexOf(startMarker);
  assert.ok(startIndex !== -1, `could not locate marker: ${startMarker}`);
  return source.slice(startIndex, startIndex + maxLen);
}

// B. Activating temporal focus does not require setSelectedNode with a real node.
test("B. handleTemporalViewOnGraph never calls setSelectedNode with a matching-focus node id — only setSelectedNode(null)", () => {
  const handler = extractBlock("const handleTemporalViewOnGraph = useCallback(", pageSource, 1400);
  assert.match(handler, /setSelectedNode\(null\)/);
  assert.doesNotMatch(handler, /setSelectedNode\(nodeToSelect\)/, "the old fabricated-selection pattern must be gone");
  assert.doesNotMatch(handler, /focus\.primaryNodeId/, "must not pick any node from the focus set to select");
});

// C. Inspector is not auto-opened by temporal focus activation.
test("C. the Drawer's open condition is driven only by selectedNode — handleTemporalViewOnGraph setting selectedNode to null means no Inspector opens", () => {
  assert.match(pageSource, /<Drawer open=\{Boolean\(selectedNode\)\}/);
  const handler = extractBlock("const handleTemporalViewOnGraph = useCallback(", pageSource, 1400);
  assert.doesNotMatch(handler, /setEdgeDrawerOpen\(true\)/);
});

// J. Explicit user node click after temporal focus still uses the normal, unguarded selection path.
test("J. the ordinary node-click handler (handleNodeClick) sets selectedNode directly with no skipNextFocusClearRef guard — a real click always clears any active focus normally", () => {
  const handler = extractBlock("function handleNodeClick(event: React.MouseEvent, node: Node) {", pageSource, 900);
  assert.match(handler, /setSelectedNode\(graphNode\)/);
  assert.doesNotMatch(handler, /skipNextFocusClearRef/, "a genuine user click must not carry the same-tick focus-preserving guard temporal/insight activation uses");
});

// K. "ดูทั้งเครือข่าย" clears presentation focus — via clearing activeTemporalFocus, which presentationFocus is directly derived from.
test("K. presentationFocus passed to buildDrugNetworkFlowGraph is derived directly from activeTemporalFocus (null when cleared)", () => {
  assert.match(pageSource, /presentationFocus:\s*activeTemporalFocus\s*\n?\s*\?\s*\{\s*nodeIds:\s*activeTemporalFocus\.nodeIds,\s*edgeIds:\s*activeTemporalFocus\.edgeIds\s*\}\s*\n?\s*:\s*null,/);
});

// L. "กลับไปนาฬิกา" preserves TemporalSelection — it must never touch temporalSelection/setTemporalSelection.
test("L. handleBackToTemporalClock never touches temporalSelection/setTemporalSelection — only the graph-focus presentation state", () => {
  const handler = extractBlock("const handleBackToTemporalClock = useCallback(() => {", pageSource, 300);
  assert.doesNotMatch(handler, /setTemporalSelection/);
  assert.doesNotMatch(handler, /temporalSelection:/);
  assert.match(handler, /setActiveTemporalFocus\(null\)/);
  assert.match(handler, /setShowTemporalExplorer\(true\)/);
});

// O. Temporal graph focus still uses no second fetch/query — the panel/page never call useDrugNetworkNeighborhood or any hook a second time for this feature.
test("O. handleTemporalViewOnGraph performs no additional data fetch — it only reads neighborhood.data (already loaded) and sets local presentation state", () => {
  const handler = extractBlock("const handleTemporalViewOnGraph = useCallback(", pageSource, 1400);
  assert.doesNotMatch(handler, /useDrugNetworkNeighborhood|fetch\(|drugIntelligenceClient\./);
});

// P. zero-match/all-data disabled behavior remains unchanged — the panel's "ดูบนผัง" button is still gated by canViewOnGraph (graphFocus != null && isEffectiveTemporalNarrowing).
test("P. the panel's onViewOnGraph invocation remains gated behind a non-null graphFocus (zero-match/all-data disabled state unchanged by this hotfix)", () => {
  const panelSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_temporal_explorer_panel.tsx"), "utf8");
  assert.match(panelSource, /disabled=\{!canViewOnGraph\}/);
  assert.match(panelSource, /const canViewOnGraph = Boolean\(onViewOnGraph\) && graphFocus != null;/);
});

// Effect dependency safety: activeTemporalFocus must be in the flow-graph-build effect's dependency array, since temporal activation no longer reliably changes selectedNode?.id (the previous justification for its omission).
test("the flow-graph-build effect's dependency array includes activeTemporalFocus, since temporal focus activation no longer changes selectedNode?.id", () => {
  const depsMatch = pageSource.match(/\}, \[neighborhood\.data, querySignature, selectedNode\?\.id[\s\S]{0,700}?\]\);/);
  assert.ok(depsMatch, "could not locate the flow-graph-build effect's dependency array");
  assert.match(depsMatch![0], /\bactiveTemporalFocus\b/);
});
