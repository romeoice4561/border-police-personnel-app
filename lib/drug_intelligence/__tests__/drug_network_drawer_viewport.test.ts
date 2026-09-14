/**
 * Drawer-aware selected-path viewport — presentation only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  computeDrawerAwarePathViewport,
  pathNodesBounds,
  resolveDrawerPanelMaxWidth,
  shouldFitSelectedPath,
  visibleCanvasWidthLeftOfDrawer,
  DRAWER_PANEL_MAX_WIDTH_SM_PX,
  DRAWER_PANEL_MAX_WIDTH_PX,
} from "@/lib/drug_intelligence/drug_network_drawer_viewport";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const drawerSource = readFileSync(path.join(dir, "..", "..", "..", "components", "ui", "drawer.tsx"), "utf8");

const pathNodes = [
  { id: "focus", position: { x: 0, y: 0 }, width: 240, height: 150, isFocus: true },
  { id: "dest", position: { x: 560, y: 300 }, width: 180, height: 110 },
];

test("drawer width tokens match the Drawer panel Tailwind classes", () => {
  assert.match(drawerSource, /max-w-md/);
  assert.match(drawerSource, /sm:max-w-lg/);
  assert.equal(resolveDrawerPanelMaxWidth(1440), DRAWER_PANEL_MAX_WIDTH_SM_PX);
  assert.equal(resolveDrawerPanelMaxWidth(390), DRAWER_PANEL_MAX_WIDTH_PX);
});

test("visible canvas width subtracts only the drawer overlap on the canvas", () => {
  const noOverlap = visibleCanvasWidthLeftOfDrawer({
    canvasWidth: 800,
    canvasRight: 800,
    drawerWidth: 512,
    viewportWidth: 1440,
  });
  assert.equal(noOverlap, 800, "drawer starting at 928 must not shrink a canvas that ends at 800");
  const covered = visibleCanvasWidthLeftOfDrawer({
    canvasWidth: 1200,
    canvasRight: 1440,
    drawerWidth: 512,
    viewportWidth: 1440,
  });
  assert.equal(covered, 1200 - 512);
});

test("path bounds include both endpoints", () => {
  const bounds = pathNodesBounds(pathNodes)!;
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  assert.ok(bounds.width >= 740);
  assert.ok(bounds.height >= 410);
});

test("drawer-aware viewport keeps the destination left of the occupied drawer region", () => {
  const viewport = computeDrawerAwarePathViewport({
    nodes: pathNodes,
    canvasWidth: 1200,
    canvasHeight: 640,
    canvasRight: 1440,
    drawerWidth: 512,
    viewportWidth: 1440,
  })!;
  const destScreenX = 560 * viewport.zoom + viewport.x;
  const destRight = destScreenX + 180 * viewport.zoom;
  assert.ok(destRight <= 1200 - 512 + 1, `destination right ${destRight.toFixed(1)} must stay in the visible 688px`);
  const focusScreenX = 0 * viewport.zoom + viewport.x;
  assert.ok(focusScreenX >= -1, "focus must remain on-screen to the left");
  assert.ok(viewport.zoom <= 1.08);
});

test("1280 viewport also keeps both path endpoints in the uncovered canvas", () => {
  const viewport = computeDrawerAwarePathViewport({
    nodes: pathNodes,
    canvasWidth: 1040,
    canvasHeight: 560,
    canvasRight: 1280,
    drawerWidth: 512,
    viewportWidth: 1280,
  })!;
  const destRight = 560 * viewport.zoom + viewport.x + 180 * viewport.zoom;
  assert.ok(destRight <= 1040 - 512 + 1, `destination right ${destRight.toFixed(1)} must stay in the visible 528px`);
  assert.ok(0 * viewport.zoom + viewport.x >= -1);
});

test("shouldFitSelectedPath is once per selection and never while dragging", () => {
  assert.equal(
    shouldFitSelectedPath({ selectedId: "veh", focusId: "p1", lastFittedSelectionId: null, isDragging: false }),
    true
  );
  assert.equal(
    shouldFitSelectedPath({ selectedId: "veh", focusId: "p1", lastFittedSelectionId: "veh", isDragging: false }),
    false
  );
  assert.equal(
    shouldFitSelectedPath({ selectedId: "veh", focusId: "p1", lastFittedSelectionId: null, isDragging: true }),
    false
  );
  assert.equal(
    shouldFitSelectedPath({ selectedId: "p1", focusId: "p1", lastFittedSelectionId: null, isDragging: false }),
    false
  );
});

test("page selected-path fit uses the drawer-aware helper instead of full-canvas fitView", () => {
  assert.match(pageSource, /computeDrawerAwarePathViewport/);
  assert.match(pageSource, /shouldFitSelectedPath/);
  assert.match(pageSource, /data-app-drawer|querySelector\("\[data-app-drawer\]"\)/);
  assert.doesNotMatch(pageSource, /fitView\(\{ nodes: pathNodes/);
});
