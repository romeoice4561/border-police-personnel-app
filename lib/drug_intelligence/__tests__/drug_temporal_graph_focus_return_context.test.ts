/**
 * DI-8.7 V1.5B VISUAL HOTFIX (2nd round) — page-level source contract
 * tests for the "last-active temporal return context" lifecycle
 * (Section: remembered-context requirements added mid-round).
 *
 * Covers:
 *   - lastActiveTemporalReturnSelection is set on "ดูบนผัง" activation
 *     and on temporal-focus restoration
 *   - it is explicitly cleared by "ดูทั้งเครือข่าย", by activating
 *     insight focus, and by an explicit Crime Clock reset/clear to empty
 *   - it is NEVER cleared by an ordinary node click (handleNodeClick)
 *   - temporalAwareReturnPath is keyed on it, not on the live
 *     activeTemporalFocus (Section H/I: "กลับไปนาฬิกา" preserves
 *     TemporalSelection; "ดูทั้งเครือข่าย" clears presentation focus
 *     without silently keeping a stale returnTo)
 *   - the restoration effect reconstructs temporal focus with no
 *     selected node and no Inspector auto-open (item D)
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

test("lastActiveTemporalReturnSelection state exists and starts null", () => {
  assert.match(pageSource, /const \[lastActiveTemporalReturnSelection, setLastActiveTemporalReturnSelection\] = useState<TemporalSelection \| null>\(null\);/);
});

test("handleTemporalViewOnGraph (ดูบนผัง) sets lastActiveTemporalReturnSelection from the live temporalSelection", () => {
  const handler = extractBlock("const handleTemporalViewOnGraph = useCallback(", pageSource, 2400);
  assert.match(handler, /setLastActiveTemporalReturnSelection\(temporalSelection\)/);
});

test("the temporal-focus restoration effect also sets lastActiveTemporalReturnSelection, so a subsequent case-open still carries context after a page reload/return", () => {
  const effect = extractBlock("const lastAttemptedTemporalRestoreKeyRef = useRef<string | null>(null);", pageSource, 2900);
  assert.match(effect, /setLastActiveTemporalReturnSelection\(restoredSelection\)/);
});

test("'ดูทั้งเครือข่าย' (FULL_NETWORK) explicitly clears lastActiveTemporalReturnSelection", () => {
  const fullNetworkBranch = extractBlock('if (mode === "FULL_NETWORK") {', pageSource, 1300);
  assert.match(fullNetworkBranch, /setLastActiveTemporalReturnSelection\(null\)/);
});

test("activating insight focus (an independent, different focus) explicitly clears lastActiveTemporalReturnSelection", () => {
  const handler = extractBlock("const handleInsightViewOnGraph = useCallback(", pageSource, 700);
  assert.match(handler, /setLastActiveTemporalReturnSelection\(null\)/);
});

test("an explicit Crime Clock reset/clear to a fully empty selection clears lastActiveTemporalReturnSelection, via handleTemporalSelectionChange", () => {
  const handler = extractBlock("const handleTemporalSelectionChange = useCallback(", pageSource, 400);
  assert.match(handler, /isSelectionEmpty\(next\)/);
  assert.match(handler, /setLastActiveTemporalReturnSelection\(null\)/);
});

test("the panel's onSelectionChange is wired to handleTemporalSelectionChange (the clearing-aware wrapper), not the raw setTemporalSelection", () => {
  assert.match(pageSource, /onSelectionChange=\{handleTemporalSelectionChange\}/);
  assert.doesNotMatch(pageSource, /onSelectionChange=\{setTemporalSelection\}/);
});

test("handleNodeClick (an ordinary ANALYST canvas click) never touches lastActiveTemporalReturnSelection — a ดูคดี after inspecting a node must still carry context", () => {
  const handler = extractBlock("function handleNodeClick(event: React.MouseEvent, node: Node) {", pageSource, 900);
  assert.doesNotMatch(handler, /LastActiveTemporalReturnSelection/);
});

test("handleBackToTemporalClock (กลับไปนาฬิกา) never touches lastActiveTemporalReturnSelection — only the graph-focus presentation state and the panel's visibility", () => {
  const handler = extractBlock("const handleBackToTemporalClock = useCallback(() => {", pageSource, 300);
  assert.doesNotMatch(handler, /LastActiveTemporalReturnSelection/);
});

test("temporalAwareReturnPath is keyed on lastActiveTemporalReturnSelection, not on the live activeTemporalFocus (so it survives a real node click that clears activeTemporalFocus)", () => {
  const memo = extractBlock("const temporalAwareReturnPath = useMemo(() => {", pageSource, 900);
  assert.match(memo, /if \(!lastActiveTemporalReturnSelection\) return currentNetworkHref;/);
  assert.doesNotMatch(memo, /if \(!activeTemporalFocus\) return currentNetworkHref;/);
});

test("the Inspector's node-detail case-detail link (openReturnPath) uses temporalAwareReturnPath, not the plain currentNetworkHref", () => {
  const drawer = extractBlock("<DrugNetworkNodeDetail", pageSource, 300);
  assert.match(drawer, /openReturnPath=\{temporalAwareReturnPath\}/);
});

test("the Inspector's edge-detail (openReturnPath) also uses temporalAwareReturnPath", () => {
  const drawer = extractBlock("<DrugNetworkEdgeDetail", pageSource, 300);
  assert.match(drawer, /openReturnPath=\{temporalAwareReturnPath\}/);
});

test("the double-click case-open shortcut (handleNodeDoubleClick) also uses temporalAwareReturnPath", () => {
  const handler = extractBlock("function handleNodeDoubleClick(_event: React.MouseEvent, node: Node) {", pageSource, 400);
  assert.match(handler, /drugEntityDetailHref\(graphNode\.type, graphNode\.id, temporalAwareReturnPath\)/);
});

// D. temporal return restoration.
test("D. the restoration effect reconstructs activeTemporalFocus purely via computeTemporalGraphFocus from the already-loaded neighborhood — no selected node is ever set", () => {
  const effect = extractBlock("const lastAttemptedTemporalRestoreKeyRef = useRef<string | null>(null);", pageSource, 2900);
  assert.match(effect, /computeTemporalGraphFocus\(\{/);
  assert.doesNotMatch(effect, /setSelectedNode\(/, "restoration must never select a node (no Inspector auto-open)");
  assert.doesNotMatch(effect, /fetch\(|drugIntelligenceClient\./, "restoration must use the already-loaded neighborhood.data — no second fetch");
});
// D2 (ROUND 3 — root cause fix): the guard is now keyed on the restore
// REQUEST itself (via the pure shouldAttemptTemporalRestore predicate),
// not a one-shot boolean tied to the page component's instance lifetime —
// see drug_temporal_restore_lifecycle.test.ts for the actual bug this fixes.
test("D2. the restoration effect uses shouldAttemptTemporalRestore (a pure, request-keyed predicate) instead of a one-shot boolean ref — this is the round-3 root-cause fix", () => {
  const effect = extractBlock("const lastAttemptedTemporalRestoreKeyRef = useRef<string | null>(null);", pageSource, 2900);
  assert.match(effect, /shouldAttemptTemporalRestore\(\{/);
  assert.match(effect, /const restoreKey = searchParams\.toString\(\);/);
  assert.match(effect, /lastAttemptedRestoreKey: lastAttemptedTemporalRestoreKeyRef\.current/);
  assert.match(effect, /if \(decision\.consumeKey\) lastAttemptedTemporalRestoreKeyRef\.current = restoreKey;/);
  assert.doesNotMatch(pageSource, /const temporalFocusRestoredRef = useRef\(false\)/, "the old one-shot boolean guard must be gone");
});
