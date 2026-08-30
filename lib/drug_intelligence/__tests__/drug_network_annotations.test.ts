/**
 * DI-9.4 — Drawing & Annotation Toolkit: comprehensive test suite.
 *
 * All tests operate at the source-level (no React rendering harness — matching
 * the existing codebase convention: drug_network_workspace_mode.test.ts,
 * drug_network_edge_routing.test.ts, etc.).
 *
 * Test coverage:
 *   A–H  Architecture: strict separation from factual graph data
 *   I–T  Toolbar: presence, tools, active state, post-creation SELECT
 *   U–AQ Annotations: create/move/resize/color/delete/protect factual nodes
 *   AH–AQ Mode/Lock/Layout behaviour
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  nextAnnotationId,
  isAnnotationId,
  annotationFlowNodeType,
  createRectangleAnnotation,
  createEllipseAnnotation,
  createTextAnnotation,
  createLineAnnotation,
  createArrowAnnotation,
  createImageAnnotation,
  updateAnnotation,
  removeAnnotation,
  buildDuplicateAnnotation,
  isShapeAnnotation,
  isLineAnnotation,
  ANNOTATION_DEFAULTS,
  ANNOTATION_STROKE_WIDTHS,
  ANNOTATION_DEFAULT_COLORS,
  ANNOTATION_DEFAULT_SIZES,
} from "../drug_network_annotations";

const dir = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel: string): string {
  return readFileSync(path.join(dir, "..", "..", "..", rel), "utf8");
}

const pageSource   = readSrc("app/drug-intelligence/network/page.tsx");
const annSource    = readSrc("lib/drug_intelligence/drug_network_annotations.ts");
const toolbarSource = readSrc("components/drug_intelligence/drug_network_analyst_toolbar.tsx");
const nodeSource   = readSrc("components/drug_intelligence/drug_network_annotation_node.tsx");
const inspSource   = readSrc("components/drug_intelligence/drug_network_annotation_inspector.tsx");
const statusSource = readSrc("components/drug_intelligence/drug_network_status_bar.tsx");

/** Strip block comments and line comments so token-presence checks aren't fooled by commentary. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")     // block comments
    .replace(/\/\/[^\r\n]*/g, " ");         // line comments
}

const pageCode   = stripComments(pageSource);
const annCode    = stripComments(annSource);
const nodeCode   = stripComments(nodeSource);

// ════════════════════════════════════════════════════════════════════════════
// A–H  ARCHITECTURE: strict factual / annotation separation
// ════════════════════════════════════════════════════════════════════════════

describe("A-H: architecture — factual/annotation separation", () => {

  // A. Annotation objects carry NO graphNode, NO edgeKind, NO evidence (in actual code, not comments)
  test("A: DrugNetworkAnnotation interface has no graphNode, edgeKind, or evidence fields", () => {
    // Use comment-stripped source so doc-comment mentions don't cause false positives
    assert.doesNotMatch(annCode, /graphNode/);
    assert.doesNotMatch(annCode, /edgeKind/);
    assert.doesNotMatch(annCode, /evidence/);
  });

  // B. Annotation model does not import DrugGraphEdge
  test("B: annotation model does not import or reference DrugGraphEdge", () => {
    assert.doesNotMatch(annCode, /DrugGraphEdge/);
  });

  // C. Status-bar nodeCount comes from neighborhood.data.nodes.length (factual), not flowNodes.length
  test("C: nodeCount in status bar comes from neighborhood.data.nodes.length (factual only)", () => {
    assert.match(pageCode, /nodeCount=\{neighborhood\.data\.nodes\.length\}/);
    // Annotations NEVER inflate the nodeCount
    assert.doesNotMatch(pageCode, /nodeCount=\{.*annotations.*\}/);
  });

  // D. Status-bar edgeCount comes from neighborhood.data.edges.length (factual), not flowEdges.length
  test("D: edgeCount in status bar comes from neighborhood.data.edges.length (factual only)", () => {
    assert.match(pageCode, /edgeCount=\{neighborhood\.data\.edges\.length\}/);
  });

  // E. Annotations never enter Find Connection (BFS path logic)
  test("E: annotations are not passed to useDrugNetworkPath or useDrugNetworkNeighborhood", () => {
    const pathHookCall = pageCode.slice(pageCode.indexOf("useDrugNetworkPath"), pageCode.indexOf("useDrugNetworkPath") + 300);
    assert.doesNotMatch(pathHookCall, /annotation/i);
    const neighborhoodCall = pageCode.slice(pageCode.indexOf("useDrugNetworkNeighborhood"), pageCode.indexOf("useDrugNetworkNeighborhood") + 600);
    assert.doesNotMatch(neighborhoodCall, /annotation/i);
  });

  // F. Annotation ids use "ann-" prefix to prevent id collisions with factual entities
  test("F: nextAnnotationId returns ids starting with 'ann-'", () => {
    for (let i = 0; i < 20; i++) {
      assert.match(nextAnnotationId(), /^ann-/);
    }
  });

  // G. isAnnotationId guards correctly
  test("G: isAnnotationId returns true only for ann-* ids", () => {
    assert.equal(isAnnotationId("ann-123abc-1"), true);
    assert.equal(isAnnotationId("ann-"), true); // prefix present
    assert.equal(isAnnotationId("node-uuid-123"), false);
    assert.equal(isAnnotationId("edge-uuid-456"), false);
    assert.equal(isAnnotationId(""), false);
    assert.equal(isAnnotationId("PERSON-abc"), false);
  });

  // H. annotationFlowNodeType never returns "drugGraphNode" or a factual edge type
  test("H: annotationFlowNodeType only returns 'annotationShape' or 'annotationLine'", () => {
    const allTypes = ["RECTANGLE", "ELLIPSE", "TEXT", "IMAGE", "LINE", "ARROW"] as const;
    for (const t of allTypes) {
      const result = annotationFlowNodeType(t);
      assert.ok(result === "annotationShape" || result === "annotationLine", `unexpected type for ${t}: ${result}`);
      assert.notEqual(result, "drugGraphNode");
      assert.notEqual(result, "smoothstep");
      assert.notEqual(result, "drugRoutedEdge");
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// I–T  TOOLBAR: visibility, tools, active state
// ════════════════════════════════════════════════════════════════════════════

describe("I-T: toolbar presence and tool coverage", () => {

  // I. Toolbar is absent (not imported) when effectiveWorkspaceMode is VIEW
  test("I: toolbar is conditionally rendered only in Analyst Mode", () => {
    // The toolbar is guarded by effectiveWorkspaceMode === "ANALYST"
    assert.match(pageCode, /effectiveWorkspaceMode === "ANALYST"[\s\S]{0,200}DrugNetworkAnalystToolbar/);
  });

  // J. Toolbar component exists and is imported in Analyst Mode
  test("J: DrugNetworkAnalystToolbar is imported and rendered in Analyst Mode", () => {
    assert.match(pageCode, /DrugNetworkAnalystToolbar/);
    assert.match(pageCode, /from.*drug_network_analyst_toolbar/);
  });

  // K. SELECT tool defined
  test("K: SELECT tool present in toolbar source", () => {
    assert.match(toolbarSource, /"SELECT"/);
  });

  // L. PAN tool defined
  test("L: PAN tool present in toolbar source", () => {
    assert.match(toolbarSource, /"PAN"/);
  });

  // M. LINE tool defined
  test("M: LINE tool present in toolbar source", () => {
    assert.match(toolbarSource, /"LINE"/);
  });

  // N. ARROW tool defined
  test("N: ARROW tool present in toolbar source", () => {
    assert.match(toolbarSource, /"ARROW"/);
  });

  // O. RECTANGLE tool defined
  test("O: RECTANGLE tool present in toolbar source", () => {
    assert.match(toolbarSource, /"RECTANGLE"/);
  });

  // P. ELLIPSE tool defined
  test("P: ELLIPSE tool present in toolbar source", () => {
    assert.match(toolbarSource, /"ELLIPSE"/);
  });

  // Q. TEXT tool defined
  test("Q: TEXT tool present in toolbar source", () => {
    assert.match(toolbarSource, /"TEXT"/);
  });

  // R. IMAGE tool defined
  test("R: IMAGE tool present in toolbar source", () => {
    assert.match(toolbarSource, /"IMAGE"/);
  });

  // S. Active tool gets a distinct visual state (aria-checked + bg-accent class)
  test("S: active tool button uses aria-checked and bg-accent styling", () => {
    assert.match(toolbarSource, /aria-checked/);
    assert.match(toolbarSource, /bg-accent/);
  });

  // T. Page returns to SELECT after placing shape annotation (not line/arrow)
  test("T: page resets activeTool to SELECT after placing RECTANGLE/ELLIPSE/TEXT", () => {
    // Look for setActiveTool("SELECT") after the creation switch statement
    assert.match(pageCode, /setActiveTool\("SELECT"\)/);
    // And the activation guard: only creation tools advance to SELECT reset
    assert.match(pageCode, /activeTool !== "SELECT" && activeTool !== "PAN"/);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// U–AG  ANNOTATIONS: create, move, resize, color, delete, factual guard
// ════════════════════════════════════════════════════════════════════════════

describe("U-AG: annotation creation and mutation", () => {

  // U. createRectangleAnnotation returns correct type
  test("U: createRectangleAnnotation produces a RECTANGLE annotation", () => {
    const ann = createRectangleAnnotation();
    assert.equal(ann.type, "RECTANGLE");
    assert.match(ann.id, /^ann-/);
    assert.equal(typeof ann.color, "string");
    assert.equal(typeof ann.strokeWidth, "number");
    // Must NOT have graphNode, edgeKind, evidence
    assert.equal("graphNode" in ann, false);
    assert.equal("edgeKind" in ann, false);
    assert.equal("evidence" in ann, false);
  });

  // V. updateAnnotation — position update (using patch on annotation data)
  test("V: updateAnnotation patches the annotation by id without mutating others", () => {
    const a = createRectangleAnnotation();
    const b = createEllipseAnnotation();
    const original = [a, b];
    const updated = updateAnnotation(original, a.id, { color: "#ff0000" });
    assert.equal(updated[0].color, "#ff0000");
    assert.equal(updated[1].color, b.color); // b unchanged
    assert.notEqual(updated, original); // new array
  });

  // W. updateAnnotation returns original reference when id not found
  test("W: updateAnnotation returns the original array reference when id is absent", () => {
    const anns = [createRectangleAnnotation()];
    const result = updateAnnotation(anns, "ann-nonexistent-99", { color: "#f00" });
    assert.strictEqual(result, anns);
  });

  // X. createEllipseAnnotation
  test("X: createEllipseAnnotation produces an ELLIPSE annotation", () => {
    const ann = createEllipseAnnotation();
    assert.equal(ann.type, "ELLIPSE");
    assert.match(ann.id, /^ann-/);
  });

  // Y. createTextAnnotation
  test("Y: createTextAnnotation produces a TEXT annotation with empty text", () => {
    const ann = createTextAnnotation();
    assert.equal(ann.type, "TEXT");
    assert.equal(ann.text, "");
    assert.equal(typeof ann.fontSize, "number");
  });

  // Z. updateAnnotation — text edit
  test("Z: updateAnnotation can patch text content", () => {
    const ann = createTextAnnotation();
    const [updated] = updateAnnotation([ann], ann.id, { text: "ข้อความทดสอบ" });
    assert.equal(updated.text, "ข้อความทดสอบ");
  });

  // AA. createLineAnnotation
  test("AA: createLineAnnotation produces a LINE with endOffset", () => {
    const end = { x: 150, y: 80 };
    const ann = createLineAnnotation(end);
    assert.equal(ann.type, "LINE");
    assert.deepEqual(ann.endOffset, end);
    assert.equal(typeof ann.color, "string");
  });

  // AB. createArrowAnnotation
  test("AB: createArrowAnnotation produces an ARROW with endOffset", () => {
    const end = { x: -50, y: 100 };
    const ann = createArrowAnnotation(end);
    assert.equal(ann.type, "ARROW");
    assert.deepEqual(ann.endOffset, end);
  });

  // AC. Color change via updateAnnotation
  test("AC: color change through updateAnnotation produces correct color", () => {
    const ann = createRectangleAnnotation();
    const colors = ANNOTATION_DEFAULT_COLORS;
    for (const color of colors) {
      const [updated] = updateAnnotation([ann], ann.id, { color });
      assert.equal(updated.color, color);
    }
  });

  // AD. Stroke width change
  test("AD: strokeWidth change through updateAnnotation is respected", () => {
    const ann = createLineAnnotation({ x: 100, y: 0 });
    for (const w of ANNOTATION_STROKE_WIDTHS) {
      const [updated] = updateAnnotation([ann], ann.id, { strokeWidth: w });
      assert.equal(updated.strokeWidth, w);
    }
  });

  // AE. removeAnnotation
  test("AE: removeAnnotation removes the annotation with the given id", () => {
    const a = createRectangleAnnotation();
    const b = createEllipseAnnotation();
    const result = removeAnnotation([a, b], a.id);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, b.id);
  });

  // AF. Factual node guard: isAnnotationId(id) returns false for factual ids
  test("AF: isAnnotationId returns false for factual node ids (UUID-style)", () => {
    const factualIds = [
      "550e8400-e29b-41d4-a716-446655440000",
      "person-abc123",
      "case-xyz789",
      "phone-111",
    ];
    for (const id of factualIds) {
      assert.equal(isAnnotationId(id), false, `should not treat "${id}" as annotation`);
    }
  });

  // AG. deleteKeyCode is null — xyflow never deletes nodes on Delete key press
  test("AG: ReactFlow deleteKeyCode is set to null (xyflow never auto-deletes)", () => {
    assert.match(pageCode, /deleteKeyCode=\{null\}/);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// AH–AQ  MODE / LOCK / LAYOUT
// ════════════════════════════════════════════════════════════════════════════

describe("AH-AQ: mode, board lock, and auto-layout integration", () => {

  // AH. View Mode: toolbar absent
  test("AH: toolbar render is guarded by effectiveWorkspaceMode === ANALYST", () => {
    assert.match(pageCode, /effectiveWorkspaceMode === "ANALYST"[\s\S]{0,100}DrugNetworkAnalystToolbar/);
  });

  // AI. Returning to Analyst preserves annotations (annotations state is in component, not coupled to workspaceMode)
  test("AI: annotations state is not cleared when switching workspaceMode", () => {
    // The workspaceMode setter is setWorkspaceMode — it never touches annotations
    const modeSwitchBlock = pageCode.slice(
      pageCode.indexOf("setWorkspaceMode"),
      pageCode.indexOf("setWorkspaceMode") + 200
    );
    assert.doesNotMatch(modeSwitchBlock, /setAnnotations/);
    assert.doesNotMatch(modeSwitchBlock, /annotation.*\[\]/);
  });

  // AJ. Board Lock blocks creation: handlePaneClick returns early if boardLocked
  test("AJ/AL: pane-click creation is blocked when boardLocked", () => {
    // The handlePaneClick function returns early when boardLocked
    assert.match(pageCode, /boardLocked\)[\s\S]*?return/);
  });

  // AK. Board Lock: annotation node draggable = false
  test("AK: annotation flow nodes are marked not-draggable when boardLocked", () => {
    assert.match(pageCode, /draggable.*analystMode.*!boardLocked/);
  });

  // AM. Annotation deletion is guarded: deleteAnnotation checks boardLocked
  test("AM: deleteAnnotation returns early when boardLocked", () => {
    assert.match(pageCode, /if[\s\S]*?boardLocked[\s\S]*?return/);
  });

  // AN. Auto-layout does not move annotation nodes
  test("AN: build effect filters annotation nodes from factual node processing", () => {
    // The build effect separates annotation nodes via isAnnotationId
    assert.match(pageCode, /isAnnotationId.*n\.id/);
    assert.match(pageCode, /currentAnnotationNodes.*filter.*isAnnotationId/);
  });

  // AO. Pin/rearrange: pinnedNodeIds does not include annotation ids
  test("AO: prunePinnedNodeIds is called with neighborhood.data node ids (factual only)", () => {
    assert.match(pageCode, /prunePinnedNodeIds.*pinnedNodeIds.*currentNodeIds/);
    // neighborhood.data.nodes contains only factual node ids
    assert.match(pageCode, /neighborhood\.data\.nodes\.map.*n\.id/);
  });

  // AP. Edge routing is unaffected by annotation presence
  test("AP: edgeRoutes is pruned using neighborhood.data.edges factual set", () => {
    assert.match(pageCode, /neighborhood\.data\.edges\.map/);
    assert.match(pageCode, /pruneEdgeRoutes/);
  });

  // AQ. Focus change clears annotations
  test("AQ: annotations are cleared when focusId or focusType changes", () => {
    assert.match(pageCode, /setAnnotations.*\[\]/);
    assert.match(pageCode, /annotationsClearedOnFocusChange/);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// Additional: annotation data purity
// ════════════════════════════════════════════════════════════════════════════

describe("additional: annotation data purity and helper correctness", () => {

  test("isShapeAnnotation returns true for RECTANGLE and ELLIPSE only", () => {
    assert.equal(isShapeAnnotation("RECTANGLE"), true);
    assert.equal(isShapeAnnotation("ELLIPSE"), true);
    assert.equal(isShapeAnnotation("TEXT"), false);
    assert.equal(isShapeAnnotation("LINE"), false);
    assert.equal(isShapeAnnotation("ARROW"), false);
    assert.equal(isShapeAnnotation("IMAGE"), false);
  });

  test("isLineAnnotation returns true for LINE and ARROW only", () => {
    assert.equal(isLineAnnotation("LINE"), true);
    assert.equal(isLineAnnotation("ARROW"), true);
    assert.equal(isLineAnnotation("RECTANGLE"), false);
    assert.equal(isLineAnnotation("ELLIPSE"), false);
    assert.equal(isLineAnnotation("TEXT"), false);
    assert.equal(isLineAnnotation("IMAGE"), false);
  });

  test("nextAnnotationId produces unique ids per call", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(nextAnnotationId());
    assert.equal(ids.size, 100);
  });

  test("buildDuplicateAnnotation creates a new id and preserves type+style", () => {
    const original = createRectangleAnnotation({ ...ANNOTATION_DEFAULTS, color: "#ef4444" });
    const dup = buildDuplicateAnnotation(original);
    assert.notEqual(dup.id, original.id);
    assert.match(dup.id, /^ann-/);
    assert.equal(dup.type, "RECTANGLE");
    assert.equal(dup.color, "#ef4444");
  });

  test("createImageAnnotation stores the imageSrc and sets type IMAGE", () => {
    const src = "blob:http://localhost/fake-object-url";
    const ann = createImageAnnotation(src);
    assert.equal(ann.type, "IMAGE");
    assert.equal(ann.imageSrc, src);
    assert.match(ann.id, /^ann-/);
  });

  test("ANNOTATION_DEFAULT_SIZES has entries for all shape types", () => {
    const shapeTypes = ["RECTANGLE", "ELLIPSE", "TEXT", "IMAGE"] as const;
    for (const t of shapeTypes) {
      const s = ANNOTATION_DEFAULT_SIZES[t];
      assert.ok(s, `missing default size for ${t}`);
      assert.equal(typeof s.width, "number");
      assert.equal(typeof s.height, "number");
      assert.ok(s.width > 0);
      assert.ok(s.height > 0);
    }
  });

  test("annotation node source renders critical microcopy for analyst attribution", () => {
    assert.match(inspSource, /วัตถุนี้เป็นสิ่งที่ผู้วิเคราะห์เพิ่ม/);
    assert.match(inspSource, /annotationMicrocopy/);
  });

  test("annotation inspector title uses 'วัตถุประกอบการวิเคราะห์' or equivalent key", () => {
    assert.match(inspSource, /annotationInspectorTitle/);
  });

  test("annotation node component does NOT import DrugGraphNode or DrugGraphEdge types", () => {
    // Use comment-stripped source — comments explaining what's absent must not trigger false positives
    assert.doesNotMatch(nodeCode, /DrugGraphNode/);
    assert.doesNotMatch(nodeCode, /DrugGraphEdge/);
    assert.doesNotMatch(nodeCode, /edgeKind/);
    assert.doesNotMatch(nodeCode, /riskIndicators/);
  });

  test("annotation toolbar does NOT import factual graph types", () => {
    assert.doesNotMatch(toolbarSource, /DrugGraphNode/);
    assert.doesNotMatch(toolbarSource, /DrugGraphEdge/);
    assert.doesNotMatch(toolbarSource, /drug_intelligence_client/);
  });

  test("status bar annotationCount prop is separate from nodeCount (never merged)", () => {
    // The status bar renders annotationCount as a distinct span, not added to nodeCount
    assert.match(statusSource, /annotationCount/);
    assert.doesNotMatch(statusSource, /nodeCount.*\+.*annotationCount/);
    assert.doesNotMatch(statusSource, /annotationCount.*\+.*nodeCount/);
  });

  test("page uses screenToFlowPosition for annotation placement (graph-space coordinates)", () => {
    assert.match(pageCode, /screenToFlowPosition/);
  });

  test("page does NOT persist annotations to localStorage, DB, or URL", () => {
    assert.doesNotMatch(pageCode, /localStorage.*annotation/i);
    assert.doesNotMatch(pageCode, /annotation.*localStorage/i);
    // URL: annotations must NOT appear in updateParams calls
    const updateParamsBlock = pageCode.slice(pageCode.indexOf("function updateParams"), pageCode.indexOf("function updateParams") + 500);
    assert.doesNotMatch(updateParamsBlock, /annotation/i);
  });

  test("board-lock toggle is a plain local state toggle (never in URL/querySignature)", () => {
    const querySignatureMatch = pageCode.match(/const querySignature = JSON\.stringify\(\{([\s\S]*?)\}\);/);
    assert.ok(querySignatureMatch, "could not find querySignature");
    assert.doesNotMatch(querySignatureMatch![1], /boardLocked/);
    assert.doesNotMatch(querySignatureMatch![1], /annotation/);
    assert.doesNotMatch(querySignatureMatch![1], /activeTool/);
  });

  test("IMAGE tool uses object URL with validate-MIME file input, not an external URL", () => {
    assert.match(pageCode, /accept="image\/jpeg,image\/png/);
    assert.match(pageCode, /URL\.createObjectURL/);
    assert.match(pageCode, /URL\.revokeObjectURL/);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// Workspace mode regression (previously in drug_network_workspace_mode.test.ts)
// — ensure DI-9.1/9.2/9.3 invariants still hold after DI-9.4 changes
// ════════════════════════════════════════════════════════════════════════════

describe("regression: DI-9.1/9.2/9.3 mode invariants still hold", () => {

  test("View Mode is still the default workspace mode", () => {
    assert.match(pageCode, /useState<DrugNetworkWorkspaceMode>\(\s*"VIEW"\s*\)/);
  });

  test("Analyst Mode still requires drug.edit permission", () => {
    assert.match(pageCode, /canUseAnalystMode\s*=\s*can\(\s*"drug\.edit"\s*\)/);
  });

  test("effectiveWorkspaceMode falls back to VIEW without drug.edit", () => {
    assert.match(pageCode, /effectiveWorkspaceMode[\s\S]{0,80}canUseAnalystMode\s*\?\s*workspaceMode\s*:\s*"VIEW"/);
  });

  test("workspaceMode toggle never calls updateParams (must not appear in URL)", () => {
    const block = pageCode.slice(pageCode.indexOf("modeSwitcherLabel"), pageCode.indexOf("modeSwitcherLabel") + 1200);
    assert.doesNotMatch(block, /updateParams/);
  });

  test("nodeCount comes from neighborhood.data (not inflated by annotations)", () => {
    assert.match(pageCode, /nodeCount=\{neighborhood\.data\.nodes\.length\}/);
  });

  test("deleteKeyCode={null} prevents xyflow from auto-deleting nodes on Delete key", () => {
    assert.match(pageCode, /deleteKeyCode=\{null\}/);
  });

  test("factual edge reconnection is still disabled (edgesReconnectable={false})", () => {
    assert.match(pageCode, /edgesReconnectable=\{false\}/);
  });

});
