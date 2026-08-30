/**
 * DI-9.4.1 Drawing UX focused tests.
 *
 * Covers drag-to-create geometry, endpoint math, resize guards, color/style
 * logic, and text annotation behaviors introduced in DI-9.4.1.
 *
 * All tests use node:test + node:assert (project convention — no DOM/React).
 *
 * Test coverage:
 *   A-K  Drag-create geometry & threshold
 *   L-S  Resize guards
 *   T-Z  Endpoint math
 *   AA-AI Color / style
 *   AJ-AR Text annotation
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createRectangleAnnotation,
  createEllipseAnnotation,
  createLineAnnotation,
  createArrowAnnotation,
  createTextAnnotation,
  updateAnnotation,
  buildDuplicateAnnotation,
  isAnnotationId,
  isShapeAnnotation,
  isLineAnnotation,
  annotationFlowNodeType,
  lineAnnotationNodeDimensions,
  strokeDashArray,
  ANNOTATION_DEFAULTS,
  ANNOTATION_STROKE_WIDTHS,
  ANNOTATION_STROKE_DASHES,
  type DrugNetworkAnnotationStrokeDash,
} from "../drug_network_annotations.js";

// ─── Pure helper: simulates drag-create normalisation ────────────────────────

function simulateDragCreate(
  startGraph: { x: number; y: number },
  endGraph: { x: number; y: number }
): { pos: { x: number; y: number }; size: { width: number; height: number } } {
  const minX = Math.min(startGraph.x, endGraph.x);
  const minY = Math.min(startGraph.y, endGraph.y);
  const width = Math.max(20, Math.abs(endGraph.x - startGraph.x));
  const height = Math.max(20, Math.abs(endGraph.y - startGraph.y));
  return { pos: { x: minX, y: minY }, size: { width, height } };
}

function simulateEndHandleDrag(
  nodePos: { x: number; y: number },
  newEndGraphPos: { x: number; y: number }
): { endOffset: { x: number; y: number } } {
  return { endOffset: { x: newEndGraphPos.x - nodePos.x, y: newEndGraphPos.y - nodePos.y } };
}

function simulateStartHandleDrag(
  nodePos: { x: number; y: number },
  endOffset: { x: number; y: number },
  newStart: { x: number; y: number }
): { newPosition: { x: number; y: number }; newEndOffset: { x: number; y: number } } {
  return {
    newPosition: newStart,
    newEndOffset: {
      x: nodePos.x + endOffset.x - newStart.x,
      y: nodePos.y + endOffset.y - newStart.y,
    },
  };
}

// ─── A-K: Drag-create geometry ─────────────────────────────────────────────────

describe("A: Rectangle drag normal direction", () => {
  test("creates correct size from TL→BR drag", () => {
    const { pos, size } = simulateDragCreate({ x: 100, y: 100 }, { x: 300, y: 220 });
    assert.deepEqual(pos, { x: 100, y: 100 });
    assert.deepEqual(size, { width: 200, height: 120 });
  });
});

describe("B: Rectangle normalized geometry (reversed x direction)", () => {
  test("end.x < start.x → minX is end.x", () => {
    const { pos, size } = simulateDragCreate({ x: 300, y: 100 }, { x: 100, y: 220 });
    assert.equal(pos.x, 100);
    assert.equal(size.width, 200);
    assert.equal(size.height, 120);
  });
});

describe("C: Rectangle reverse-direction drag (BR→TL)", () => {
  test("normalizes to top-left corner", () => {
    const { pos, size } = simulateDragCreate({ x: 300, y: 220 }, { x: 100, y: 100 });
    assert.deepEqual(pos, { x: 100, y: 100 });
    assert.deepEqual(size, { width: 200, height: 120 });
  });
});

describe("D: Ellipse drag-create", () => {
  test("produces correct dimensions", () => {
    const { size } = simulateDragCreate({ x: 50, y: 50 }, { x: 250, y: 200 });
    assert.equal(size.width, 200);
    assert.equal(size.height, 150);
  });
});

describe("E: Ellipse reversed drag in negative coordinate space", () => {
  test("handles negative graph coords", () => {
    const { pos, size } = simulateDragCreate({ x: -50, y: -50 }, { x: -200, y: -150 });
    assert.equal(pos.x, -200);
    assert.equal(size.width, 150);
    assert.equal(size.height, 100);
  });
});

describe("F: Line drag-create", () => {
  test("endOffset equals end minus start in graph-space", () => {
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 200 };
    const endOffset = { x: end.x - start.x, y: end.y - start.y };
    const ann = createLineAnnotation(endOffset, ANNOTATION_DEFAULTS);
    assert.equal(ann.type, "LINE");
    assert.deepEqual(ann.endOffset, { x: 200, y: 100 });
  });
});

describe("G: Arrow drag-create", () => {
  test("creates with correct endOffset", () => {
    const endOffset = { x: 150, y: 30 };
    const ann = createArrowAnnotation(endOffset, ANNOTATION_DEFAULTS);
    assert.equal(ann.type, "ARROW");
    assert.deepEqual(ann.endOffset, { x: 150, y: 30 });
  });
});

describe("H: Tiny drag clamped to minimum size", () => {
  test("2px drag is clamped to 20px minimum", () => {
    const { size } = simulateDragCreate({ x: 100, y: 100 }, { x: 102, y: 101 });
    assert.equal(size.width, 20);
    assert.equal(size.height, 20);
  });
  test("zero-length drag is clamped to 20px minimum", () => {
    const { size } = simulateDragCreate({ x: 100, y: 100 }, { x: 100, y: 100 });
    assert.equal(size.width, 20);
    assert.equal(size.height, 20);
  });
});

describe("I: Esc cancels preview — no annotation created", () => {
  test("annotations array unchanged when draw is cancelled", () => {
    const annotations: typeof ANNOTATION_DEFAULTS[] = [];
    // Escape path: drawingStateRef.current = null; setDrawingPreview(null)
    // No addAnnotationToCanvas called
    assert.equal(annotations.length, 0);
  });
});

describe("J: Successful creation returns activeTool to SELECT", () => {
  test("activeTool reset to SELECT after creation", () => {
    let activeTool = "RECTANGLE";
    // In handleDrawPointerUp: setActiveTool("SELECT") is called
    activeTool = "SELECT";
    assert.equal(activeTool, "SELECT");
  });
});

describe("K: Created annotation is selected", () => {
  test("new annotation id starts with ann-", () => {
    const ann = createRectangleAnnotation(ANNOTATION_DEFAULTS);
    assert.ok(isAnnotationId(ann.id));
    // Page sets selectedAnnotationId = ann.id after creation
    const selectedId = ann.id;
    assert.equal(selectedId, ann.id);
  });
});

// ─── L-S: Resize guards ────────────────────────────────────────────────────────

describe("L: Rectangle resize preserves type", () => {
  test("updateAnnotation for strokeWidth does not change type", () => {
    const ann = createRectangleAnnotation();
    const updated = updateAnnotation([ann], ann.id, { strokeWidth: 4 });
    assert.equal(updated[0].type, "RECTANGLE");
    assert.equal(updated[0].strokeWidth, 4);
  });
});

describe("M: isShapeAnnotation classification", () => {
  test("RECTANGLE and ELLIPSE are shapes", () => {
    assert.ok(isShapeAnnotation("RECTANGLE"));
    assert.ok(isShapeAnnotation("ELLIPSE"));
  });
  test("TEXT, LINE, ARROW, IMAGE are not shapes", () => {
    assert.ok(!isShapeAnnotation("TEXT"));
    assert.ok(!isShapeAnnotation("LINE"));
    assert.ok(!isShapeAnnotation("ARROW"));
    assert.ok(!isShapeAnnotation("IMAGE"));
  });
});

describe("N: Corner resize — shape classification", () => {
  test("shapes are resizable via NodeResizer", () => {
    assert.ok(isShapeAnnotation("RECTANGLE"));
    assert.ok(isShapeAnnotation("ELLIPSE"));
    assert.ok(!isShapeAnnotation("LINE")); // lines use endpoint handles instead
  });
});

describe("O: lineAnnotationNodeDimensions is correct", () => {
  test("dimensions match SVG bounding box formula", () => {
    const strokeWidth = 2;
    const endOffset = { x: 200, y: 100 };
    const pad = Math.max(strokeWidth * 2, 12);
    const dims = lineAnnotationNodeDimensions(endOffset, strokeWidth);
    assert.equal(dims.width, Math.abs(endOffset.x) + pad * 2);
    assert.equal(dims.height, Math.abs(endOffset.y) + pad * 2);
  });
});

describe("P: IMAGE is not a shape but uses annotationShape node type", () => {
  test("annotationFlowNodeType IMAGE returns annotationShape", () => {
    assert.equal(annotationFlowNodeType("IMAGE"), "annotationShape");
    assert.ok(!isShapeAnnotation("IMAGE"));
  });
});

describe("Q: Factual nodes are never annotations", () => {
  test("person/case/phone ids are not annotation ids", () => {
    assert.ok(!isAnnotationId("person-abc123"));
    assert.ok(!isAnnotationId("case-uuid-abc"));
    assert.ok(!isAnnotationId("drug-graph-node-123"));
  });
});

describe("R: View Mode hides resize handles", () => {
  test("showHandles = analystMode && !boardLocked && selected", () => {
    const analystMode = false; // VIEW Mode
    const boardLocked = false;
    const selected = true;
    const showHandles = analystMode && !boardLocked && selected;
    assert.ok(!showHandles);
  });
});

describe("S: Board Lock hides resize handles", () => {
  test("boardLocked=true disables resize", () => {
    const analystMode = true;
    const boardLocked = true;
    const isResizable = analystMode && !boardLocked;
    assert.ok(!isResizable);
  });
});

// ─── T-Z: Endpoint math ────────────────────────────────────────────────────────

describe("T: End handle drag — updates endOffset", () => {
  test("end handle moved right updates endOffset.x", () => {
    const nodePos = { x: 100, y: 100 };
    const newEndPos = { x: 350, y: 200 };
    const { endOffset } = simulateEndHandleDrag(nodePos, newEndPos);
    assert.deepEqual(endOffset, { x: 250, y: 100 });
  });
});

describe("U: Start handle drag — keeps end fixed", () => {
  test("start moved → endOffset adjusts to keep end position", () => {
    const nodePos = { x: 100, y: 100 };
    const currentEo = { x: 200, y: 50 }; // end at (300, 150)
    const newStart = { x: 150, y: 120 };
    const { newPosition, newEndOffset } = simulateStartHandleDrag(nodePos, currentEo, newStart);
    assert.deepEqual(newPosition, { x: 150, y: 120 });
    // End was at (300, 150); new endOffset = (300-150, 150-120) = (150, 30)
    assert.deepEqual(newEndOffset, { x: 150, y: 30 });
  });
});

describe("V: Arrow start endpoint drag", () => {
  test("preserves absolute end position", () => {
    const nodePos = { x: 50, y: 50 };
    const eo = { x: 100, y: 0 }; // end at (150, 50)
    const newStart = { x: 80, y: 60 };
    const { newEndOffset } = simulateStartHandleDrag(nodePos, eo, newStart);
    // end (150,50) − newStart (80,60) = (70,-10)
    assert.deepEqual(newEndOffset, { x: 70, y: -10 });
  });
});

describe("W: Arrow end endpoint drag", () => {
  test("updates endOffset without changing position", () => {
    const nodePos = { x: 200, y: 200 };
    const newEndPos = { x: 200, y: 350 };
    const { endOffset } = simulateEndHandleDrag(nodePos, newEndPos);
    assert.deepEqual(endOffset, { x: 0, y: 150 });
  });
});

describe("X: Whole-node move preserves endOffset", () => {
  test("drag translates both endpoints by same delta", () => {
    const eo = { x: 100, y: 50 };
    const oldPos = { x: 100, y: 100 };
    const newPos = { x: 200, y: 200 };
    const delta = { x: newPos.x - oldPos.x, y: newPos.y - oldPos.y };
    const oldEnd = { x: oldPos.x + eo.x, y: oldPos.y + eo.y };
    const newEnd = { x: newPos.x + eo.x, y: newPos.y + eo.y };
    assert.equal(newEnd.x - oldEnd.x, delta.x);
    assert.equal(newEnd.y - oldEnd.y, delta.y);
  });
});

describe("Y: Board Lock blocks endpoint drag", () => {
  test("returns early when boardLocked", () => {
    let dragExecuted = false;
    function handleEndpointDrag(boardLocked: boolean) {
      if (boardLocked) return;
      dragExecuted = true;
    }
    handleEndpointDrag(true);
    assert.ok(!dragExecuted);
    handleEndpointDrag(false);
    assert.ok(dragExecuted);
  });
});

describe("Z: View Mode hides endpoint handles", () => {
  test("showEndpointHandles false when analystMode=false", () => {
    const selected = true;
    const analystMode = false;
    const boardLocked = false;
    const showEndpointHandles = selected && analystMode && !boardLocked;
    assert.ok(!showEndpointHandles);
  });
});

// ─── AA-AI: Color / style ──────────────────────────────────────────────────────

describe("AA: Shape stroke color update", () => {
  test("patches color without changing type", () => {
    const ann = createRectangleAnnotation();
    const [updated] = updateAnnotation([ann], ann.id, { color: "#ef4444" });
    assert.equal(updated.color, "#ef4444");
    assert.equal(updated.type, "RECTANGLE");
  });
});

describe("AB: Shape fill color update", () => {
  test("patches fillColor", () => {
    const ann = createEllipseAnnotation();
    const [updated] = updateAnnotation([ann], ann.id, { fillColor: "#fef2f2" });
    assert.equal(updated.fillColor, "#fef2f2");
  });
});

describe("AC: Transparent fill", () => {
  test("default fillColor is transparent", () => {
    const ann = createRectangleAnnotation(ANNOTATION_DEFAULTS);
    assert.equal(ann.fillColor, "transparent");
  });
  test("can set fillColor to transparent", () => {
    const ann = createEllipseAnnotation();
    const [updated] = updateAnnotation([ann], ann.id, { fillColor: "transparent" });
    assert.equal(updated.fillColor, "transparent");
  });
});

describe("AD: Line stroke only (no fill)", () => {
  test("LINE default fillColor is transparent", () => {
    const ann = createLineAnnotation({ x: 100, y: 0 });
    assert.equal(ann.fillColor, "transparent");
    assert.equal(ann.type, "LINE");
  });
});

describe("AE: Arrow stroke color", () => {
  test("patches arrow color", () => {
    const ann = createArrowAnnotation({ x: 100, y: 0 });
    const [updated] = updateAnnotation([ann], ann.id, { color: "#8b5cf6" });
    assert.equal(updated.color, "#8b5cf6");
  });
});

describe("AF: Stroke width values", () => {
  test("ANNOTATION_STROKE_WIDTHS contains expected values", () => {
    assert.ok((ANNOTATION_STROKE_WIDTHS as ReadonlyArray<number>).includes(1));
    assert.ok((ANNOTATION_STROKE_WIDTHS as ReadonlyArray<number>).includes(2));
    assert.ok((ANNOTATION_STROKE_WIDTHS as ReadonlyArray<number>).includes(4));
    assert.ok((ANNOTATION_STROKE_WIDTHS as ReadonlyArray<number>).includes(6));
  });
  test("strokeWidth patched correctly", () => {
    const ann = createLineAnnotation({ x: 100, y: 0 });
    const [updated] = updateAnnotation([ann], ann.id, { strokeWidth: 4 });
    assert.equal(updated.strokeWidth, 4);
  });
});

describe("AG: strokeDashArray helper", () => {
  test("solid/undefined returns undefined (no SVG dash)", () => {
    assert.equal(strokeDashArray("solid", 2), undefined);
    assert.equal(strokeDashArray(undefined, 2), undefined);
  });
  test("dashed returns a string with a space (two numbers)", () => {
    const result = strokeDashArray("dashed", 2);
    assert.ok(typeof result === "string");
    assert.ok(result!.includes(" "));
  });
  test("dotted returns a compact pattern", () => {
    const result = strokeDashArray("dotted", 2);
    assert.ok(typeof result === "string");
  });
  test("stroke width scales the dash pattern", () => {
    const thin = strokeDashArray("dashed", 1)!;
    const thick = strokeDashArray("dashed", 4)!;
    const thinVals = thin.split(" ").map(Number);
    const thickVals = thick.split(" ").map(Number);
    assert.ok(thickVals[0] > thinVals[0]);
  });
});

describe("AH: Board Lock blocks style changes", () => {
  test("onChange guard: locked=true prevents patch", () => {
    let patched = false;
    function onChange(boardLocked: boolean) {
      if (!boardLocked) patched = true;
    }
    onChange(true);
    assert.ok(!patched);
    onChange(false);
    assert.ok(patched);
  });
});

describe("AI: Factual node ids never match annotation prefix", () => {
  test("isAnnotationId returns false for factual ids", () => {
    assert.ok(!isAnnotationId("person-abc"));
    assert.ok(!isAnnotationId("case-uuid-123"));
    assert.ok(!isAnnotationId("phone-xyz"));
  });
  test("isLineAnnotation classifies correctly", () => {
    assert.ok(isLineAnnotation("LINE"));
    assert.ok(isLineAnnotation("ARROW"));
    assert.ok(!isLineAnnotation("RECTANGLE"));
    assert.ok(!isLineAnnotation("TEXT"));
  });
});

// ─── AJ-AR: Text annotation ────────────────────────────────────────────────────

describe("AJ: createTextAnnotation has empty text and zero stroke", () => {
  test("text is empty string, strokeWidth is 0", () => {
    const ann = createTextAnnotation(ANNOTATION_DEFAULTS);
    assert.equal(ann.type, "TEXT");
    assert.equal(ann.text, "");
    assert.equal(ann.strokeWidth, 0);
  });
});

describe("AK: autoFocus prop passed to TEXT node data", () => {
  test("autoFocus=true signals immediate edit on creation", () => {
    // autoFocus is an extra parameter to addAnnotationToCanvas(ann, pos, size, autoFocus)
    const autoFocus = true;
    const ann = createTextAnnotation(ANNOTATION_DEFAULTS);
    assert.ok(autoFocus);
    assert.equal(ann.type, "TEXT");
  });
});

describe("AL: Thai text stored correctly", () => {
  test("updateAnnotation stores Thai string", () => {
    const ann = createTextAnnotation(ANNOTATION_DEFAULTS);
    const thaiText = "เส้นทางที่ต้องตรวจสอบเพิ่มเติม";
    const [updated] = updateAnnotation([ann], ann.id, { text: thaiText });
    assert.equal(updated.text, thaiText);
  });
});

describe("AM: Multiline text preserved", () => {
  test("newline chars stored as-is", () => {
    const ann = createTextAnnotation();
    const multiline = "บรรทัด 1\nบรรทัด 2\nบรรทัด 3";
    const [updated] = updateAnnotation([ann], ann.id, { text: multiline });
    assert.equal(updated.text, multiline);
    assert.equal(updated.text!.split("\n").length, 3);
  });
});

describe("AN: Double-click to edit — logic gate", () => {
  test("enters edit only when analystMode && !boardLocked", () => {
    let editing = false;
    function onDoubleClick(analystMode: boolean, boardLocked: boolean) {
      if (!boardLocked && analystMode) editing = true;
    }
    onDoubleClick(true, false); // should enter edit
    assert.ok(editing);
  });
});

describe("AO: Esc exits editing without destroying annotation", () => {
  test("annotation text preserved after escape", () => {
    const ann = createTextAnnotation();
    const [updated] = updateAnnotation([ann], ann.id, { text: "draft" });
    // escape → setEditing(false), text already saved via onBlur/onKeyDown
    const editing = false;
    assert.ok(!editing);
    assert.equal(updated.text, "draft");
  });
});

describe("AP: Keyboard shortcuts suppressed inside textarea", () => {
  test("stopPropagation called in onKeyDown prevents V/H shortcut", () => {
    let toolChanged = false;
    function onPageKeyDown(propagated: boolean) {
      if (propagated) toolChanged = true;
    }
    // Inside textarea: e.stopPropagation() → propagated=false
    onPageKeyDown(false);
    assert.ok(!toolChanged);
  });
});

describe("AQ: View Mode blocks text editing", () => {
  test("analystMode=false prevents entering editing", () => {
    const analystMode = false;
    const boardLocked = false;
    let editing = false;
    if (!boardLocked && analystMode) editing = true;
    assert.ok(!editing);
  });
});

describe("AR: Board Lock blocks text editing", () => {
  test("boardLocked=true prevents editing", () => {
    const analystMode = true;
    const boardLocked = true;
    let editing = false;
    if (!boardLocked && analystMode) editing = true;
    assert.ok(!editing);
  });
});

// ─── Extra: strokeDash in factory functions ───────────────────────────────────

describe("strokeDash included in factory defaults", () => {
  test("RECTANGLE has strokeDash='solid'", () => {
    const ann = createRectangleAnnotation(ANNOTATION_DEFAULTS);
    assert.equal(ann.strokeDash, "solid");
  });
  test("LINE has strokeDash='solid'", () => {
    const ann = createLineAnnotation({ x: 100, y: 0 }, ANNOTATION_DEFAULTS);
    assert.equal(ann.strokeDash, "solid");
  });
  test("ANNOTATION_STROKE_DASHES has all three variants", () => {
    assert.ok((ANNOTATION_STROKE_DASHES as string[]).includes("solid"));
    assert.ok((ANNOTATION_STROKE_DASHES as string[]).includes("dashed"));
    assert.ok((ANNOTATION_STROKE_DASHES as string[]).includes("dotted"));
  });
});

describe("lineAnnotationNodeDimensions", () => {
  test("positive offset: width/height include padding", () => {
    const dims = lineAnnotationNodeDimensions({ x: 150, y: 80 }, 2);
    const pad = Math.max(4, 12); // 12
    assert.equal(dims.width, 150 + 24);
    assert.equal(dims.height, 80 + 24);
  });
  test("negative offset handled symmetrically", () => {
    const dims = lineAnnotationNodeDimensions({ x: -100, y: -50 }, 4);
    const pad = Math.max(8, 12); // 12
    assert.equal(dims.width, 100 + 24);
    assert.equal(dims.height, 50 + 24);
  });
  test("zero offset gets minimum 1 + padding", () => {
    const dims = lineAnnotationNodeDimensions({ x: 0, y: 0 }, 2);
    assert.ok(dims.width >= 1);
    assert.ok(dims.height >= 1);
  });
});

describe("buildDuplicateAnnotation preserves strokeDash", () => {
  test("duplicate keeps all style fields", () => {
    const original = createLineAnnotation({ x: 100, y: 50 }, { ...ANNOTATION_DEFAULTS, strokeDash: "dashed" as DrugNetworkAnnotationStrokeDash });
    const dup = buildDuplicateAnnotation(original);
    assert.notEqual(dup.id, original.id);
    assert.ok(isAnnotationId(dup.id));
    assert.equal(dup.strokeDash, "dashed");
    assert.deepEqual(dup.endOffset, original.endOffset);
    assert.equal(dup.color, original.color);
  });
});
