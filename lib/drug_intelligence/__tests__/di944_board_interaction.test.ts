/**
 * DI-9.4.4 — Investigation Board interaction polish focused tests.
 * Source-string + pure-helper coverage (matches existing Network test style).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  partitionBoardSelectionIds,
  mixedSelectionDeleteLabelTh,
  mixedSelectionDeleteLabelEn,
  GROUP_DUPLICATE_OFFSET,
  buildDuplicateAnnotation,
  createRectangleAnnotation,
  createImageAnnotation,
  isAnnotationId,
} from "@/lib/drug_intelligence/drug_network_annotations";

const ROOT = join(process.cwd());
const pageSrc = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
const statusSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_status_bar.tsx"), "utf8");
const groupBarSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_group_selection_bar.tsx"), "utf8");
const globalsSrc = readFileSync(join(ROOT, "app/globals.css"), "utf8");

describe("DI-9.4.4 selection helpers", () => {
  test("partitionBoardSelectionIds separates factual vs annotations", () => {
    const p = partitionBoardSelectionIds(["person-1", "ann-abc", "case-2", "ann-xyz"]);
    assert.deepEqual(p.factualIds, ["person-1", "case-2"]);
    assert.deepEqual(p.annotationIds, ["ann-abc", "ann-xyz"]);
  });

  test("mixed delete microcopy never claims factual deletion", () => {
    const mixed = mixedSelectionDeleteLabelTh(3, 2);
    assert.match(mixed, /หมายเหตุบนผัง 3/);
    assert.doesNotMatch(mixed, /^ลบ 5/);
    const onlyAnn = mixedSelectionDeleteLabelTh(2, 0);
    assert.match(onlyAnn, /2/);
    const en = mixedSelectionDeleteLabelEn(3, 2);
    assert.match(en, /3 board annotations/i);
    assert.doesNotMatch(en, /Delete 5/);
  });

  test("group duplicate offset is defined and buildDuplicateAnnotation keeps style", () => {
    assert.ok(GROUP_DUPLICATE_OFFSET.x > 0 && GROUP_DUPLICATE_OFFSET.y > 0);
    const src = createRectangleAnnotation();
    const dup = buildDuplicateAnnotation(src);
    assert.notEqual(dup.id, src.id);
    assert.ok(isAnnotationId(dup.id));
    assert.equal(dup.color, src.color);
    assert.equal(dup.type, "RECTANGLE");
    const img = createImageAnnotation("blob:test");
    const imgDup = buildDuplicateAnnotation(img);
    assert.equal(imgDup.imageSrc, img.imageSrc);
  });
});

describe("DI-9.4.4 page wiring", () => {
  test("marquee SELECT uses selectionOnDrag and does not pan while selecting", () => {
    assert.match(pageSrc, /selectionOnDrag=\{effectiveWorkspaceMode === "ANALYST" && activeTool === "SELECT"\}/);
    assert.match(pageSrc, /panOnDrag=\{effectiveWorkspaceMode === "VIEW" \|\| activeTool === "PAN"\}/);
    assert.match(pageSrc, /multiSelectionKeyCode="Shift"/);
    assert.match(pageSrc, /selectionKeyCode=\{null\}/);
  });

  test("group drag / movement blocked by Board Lock and View Mode", () => {
    assert.match(pageSrc, /nodesDraggable=\{effectiveWorkspaceMode === "ANALYST" && !boardLocked\}/);
  });

  test("Delete/Backspace only targets annotation ids", () => {
    assert.match(pageSrc, /e\.key !== "Delete" && e\.key !== "Backspace"/);
    assert.match(pageSrc, /partitionBoardSelectionIds\(selectedCanvasIds\)/);
    assert.match(pageSrc, /deleteKeyCode=\{null\}/);
    assert.match(pageSrc, /for \(const id of targets\) deleteAnnotation\(id\)/);
  });

  test("group delete/duplicate helpers are wired", () => {
    assert.match(pageSrc, /deleteSelectedAnnotations/);
    assert.match(pageSrc, /duplicateSelectedAnnotations/);
    assert.match(pageSrc, /DrugNetworkGroupSelectionBar/);
    assert.match(groupBarSrc, /mixedSelectionDeleteLabelTh/);
    assert.match(groupBarSrc, /data-testid="group-delete-btn"/);
    assert.match(groupBarSrc, /data-testid="group-duplicate-btn"/);
  });

  test("selection status props exist on status bar", () => {
    assert.match(statusSrc, /selectionCount\?:/);
    assert.match(statusSrc, /selectedFactualCount\?:/);
    assert.match(statusSrc, /selectedAnnotationCount\?:/);
    assert.match(statusSrc, /data-testid="status-selection"/);
    assert.match(pageSrc, /selectionCount=\{selectionTotal/);
  });

  test("MiniMap uses theme tokens — no default white-only panel", () => {
    assert.match(pageSrc, /bgColor="var\(--surface\)"/);
    assert.match(pageSrc, /maskColor="color-mix/);
    assert.match(pageSrc, /nodeColor=\{\(n\) =>/);
    assert.match(globalsSrc, /--xy-minimap-background-color-default:\s*var\(--surface\)/);
    assert.doesNotMatch(pageSrc, /<MiniMap pannable zoomable className="hidden sm:block" \/>/);
  });

  test("MiniMap stays hidden on mobile (sm:block)", () => {
    assert.match(pageSrc, /className="hidden sm:block print:hidden"/);
  });

  test("Print Board action and print CSS exclude chrome", () => {
    assert.match(pageSrc, /data-testid="print-board-btn"/);
    assert.match(pageSrc, /di\.network\.printBoard/);
    assert.match(pageSrc, /window\.print\(\)/);
    assert.match(pageSrc, /data-print-board/);
    assert.match(globalsSrc, /@media print/);
    assert.match(globalsSrc, /data-print-board/);
    assert.match(globalsSrc, /react-flow__minimap/);
    assert.match(globalsSrc, /analyst-toolbar/);
    assert.match(globalsSrc, /size:\s*landscape/);
  });

  test("onSelectionChange syncs canvas multi-select", () => {
    assert.match(pageSrc, /onSelectionChange=\{handleSelectionChange\}/);
    assert.match(pageSrc, /setSelectedCanvasIds\(\(prev\) => nextCanvasSelectionIds\(prev, ids\)\)/);
    assert.match(pageSrc, /handleSelectionChange = useCallback/);
  });
});
