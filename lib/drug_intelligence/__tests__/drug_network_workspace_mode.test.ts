/**
 * DI-9.1 — Network Workspace Shell (View/Analyst mode scaffold, status bar,
 * inspector polish) regression tests.
 *
 * No React rendering harness exists in this codebase (all tests are pure
 * logic/source-level checks) — these assert the contract at the source
 * level: permission gating, mode-state safety, and that no fake
 * drawing/annotation tools were introduced.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "");
const statusBarSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_status_bar.tsx"), "utf8");
const nodeDetailSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_node_detail.tsx"), "utf8");
const edgeDetailSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_edge_detail.tsx"), "utf8");

// --- A. View Mode is default ---
test("View Mode is the default workspace mode", () => {
  assert.match(pageCode, /useState<DrugNetworkWorkspaceMode>\(\s*"VIEW"\s*\)/);
});

// --- B. Analyst Mode availability respects permission ---
test("Analyst Mode requires drug.edit, not a new permission string", () => {
  assert.match(pageCode, /canUseAnalystMode\s*=\s*can\(\s*"drug\.edit"\s*\)/);
});

test("effective workspace mode falls back to VIEW when the user lacks drug.edit, even if local state says ANALYST", () => {
  assert.match(pageCode, /effectiveWorkspaceMode[\s\S]{0,80}canUseAnalystMode\s*\?\s*workspaceMode\s*:\s*"VIEW"/);
});

test("the mode switcher UI itself is hidden (not just disabled) for a user without drug.edit", () => {
  assert.match(pageCode, /canViewNetwork\s*&&\s*canUseAnalystMode\s*\?/);
});

test("no new permission string was introduced for Analyst Mode", () => {
  const permissionStrings = pageCode.match(/can\(\s*"([a-z.]+)"\s*\)/g) ?? [];
  const distinct = new Set(permissionStrings.map((s) => s.match(/"([a-z.]+)"/)![1]));
  assert.deepEqual([...distinct].sort(), ["drug.edit", "drug.read"]);
});

// --- C. switching modes does not alter URL/filter state ---
test("setWorkspaceMode is a plain useState setter, never routed through updateParams (URL)", () => {
  const modeButtonsSection = pageCode.slice(pageCode.indexOf("modeSwitcherLabel"), pageCode.indexOf("modeSwitcherLabel") + 1200);
  assert.match(modeButtonsSection, /onClick=\{\(\) => setWorkspaceMode\("VIEW"\)\}/);
  assert.match(modeButtonsSection, /onClick=\{\(\) => setWorkspaceMode\("ANALYST"\)\}/);
  assert.doesNotMatch(modeButtonsSection, /updateParams/);
});

test("workspaceMode is never included in the querySignature that drives graph refetch/position-reset", () => {
  const querySignatureMatch = pageCode.match(/const querySignature = JSON\.stringify\(\{([\s\S]*?)\}\);/);
  assert.ok(querySignatureMatch, "could not locate querySignature");
  assert.doesNotMatch(querySignatureMatch![1], /workspaceMode/);
});

// --- D/E. status bar node/edge count ---
test("status bar receives nodeCount/edgeCount straight from the already-fetched neighborhood data, not a new query", () => {
  assert.match(pageCode, /nodeCount=\{neighborhood\.data\.nodes\.length\}/);
  assert.match(pageCode, /edgeCount=\{neighborhood\.data\.edges\.length\}/);
});

test("DrugNetworkStatusBar component renders node and edge count labels", () => {
  assert.match(statusBarSource, /di\.network\.statusNodes/);
  assert.match(statusBarSource, /di\.network\.statusEdges/);
});

// --- F. truncated warning ---
test("status bar receives the truncated flag from the real API response, never hardcoded", () => {
  assert.match(pageCode, /truncated=\{neighborhood\.data\.truncated\}/);
});

test("DrugNetworkStatusBar only renders the truncated warning when truncated is true", () => {
  const fnBody = statusBarSource.slice(statusBarSource.indexOf("export function DrugNetworkStatusBar"));
  assert.match(fnBody, /\{truncated \? \(/);
});

// --- G/H. DIRECT / INFERRED edge inspector wording ---
test("edge inspector shows a DIRECT/INFERRED badge using the existing edgeKind field, never a new field", () => {
  assert.match(edgeDetailSource, /edge\.edgeKind === "DIRECT"/);
});

test("edge inspector composes wording via the existing explainDrugGraphEdgeClient, never hand-written inline text", () => {
  assert.match(edgeDetailSource, /explainDrugGraphEdgeClient\(/);
  // No inline Thai sentence literals were added to the component body (only imported label lookups/JSX structure).
  assert.doesNotMatch(edgeDetailSource, /"ทั้งสองเป็นเครือข่ายเดียวกัน"/);
});

// --- I. evidenceCount remains a count, not confidence ---
test("evidenceCount is displayed as a plain count, never reframed as a confidence/percentage", () => {
  assert.match(edgeDetailSource, /edge\.evidenceCount/);
  assert.doesNotMatch(edgeDetailSource, /confidence/i);
  assert.doesNotMatch(edgeDetailSource, /%/);
});

// --- J. no fake annotation tools exist yet ---
test("no drawing/annotation/waypoint/undo/redo/save-board controls exist anywhere in the network page yet", () => {
  const forbiddenTokens = [
    "annotation", "Annotation",
    "waypoint", "Waypoint",
    "undo(", "redo(", "Undo(", "Redo(",
    "saveBoard", "SaveBoard",
    "drawingTool", "DrawingTool",
  ];
  for (const token of forbiddenTokens) {
    assert.ok(!pageCode.includes(token), `found forbidden DI-9.2+ token in DI-9.1 page source: "${token}"`);
  }
});

test("the Analyst Mode placeholder is a plain message, not a disabled toolbar", () => {
  assert.match(pageCode, /analystToolsComingSoon/);
  // The badge block must not itself contain a nested <button> (a real, even if disabled, tool control).
  const badgeBlock = pageCode.slice(pageCode.indexOf('effectiveWorkspaceMode === "ANALYST" ?'), pageCode.indexOf('effectiveWorkspaceMode === "ANALYST" ?') + 500);
  assert.doesNotMatch(badgeBlock, /<button/);
});

// --- K. mobile status bar reduced label set ---
test("status bar hides secondary metrics (selected/layout/zoom) below the sm breakpoint, keeping only nodes/edges/truncated", () => {
  const hiddenOnMobile = statusBarSource.match(/hidden sm:inline/g) ?? [];
  assert.equal(hiddenOnMobile.length, 3, "expected exactly 3 metrics (selected, layout, zoom) hidden on mobile");
});

// --- Additional: node inspector polish ---
test("node inspector shows an explicit entity-type heading", () => {
  assert.match(nodeDetailSource, /DRUG_GRAPH_NODE_TYPE_LABEL_KEY\[node\.type\]/);
});

test("node inspector shows PHONE carrier and SIM imsi/carrier metadata (previously omitted)", () => {
  assert.match(nodeDetailSource, /node\.metadata\.type === "PHONE"/);
  assert.match(nodeDetailSource, /node\.metadata\.type === "SIM"/);
  assert.match(nodeDetailSource, /node\.metadata\.imsi/);
});

// --- Additional: edge inspector source/target labels ---
test("edge inspector shows source and target node labels, resolved from already-fetched neighborhood data", () => {
  assert.match(edgeDetailSource, /sourceNode/);
  assert.match(edgeDetailSource, /targetNode/);
  assert.match(pageCode, /neighborhood\.data\?\.nodes\.find\(\(n\) => n\.id === selectedEdge\.source\)/);
  assert.match(pageCode, /neighborhood\.data\?\.nodes\.find\(\(n\) => n\.id === selectedEdge\.target\)/);
});
