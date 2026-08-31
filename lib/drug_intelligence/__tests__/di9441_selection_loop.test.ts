/**
 * DI-9.4.4.1 — focused Network selection sync must not loop.
 *
 * Regression for: React Flow SelectionListener → onSelectionChange →
 * setSelectedCanvasIds(freshArray) → re-render → new callback → infinite
 * "Maximum update depth exceeded" on any non-empty focused board.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  nextCanvasSelectionIds,
  sameCanvasSelectionIds,
  partitionBoardSelectionIds,
} from "@/lib/drug_intelligence/drug_network_annotations";

/** Simulates RF repeatedly emitting the same selection (as SelectionListener does
 * when the callback identity changes). Counts how many times state actually updates. */
function simulateSelectionSync(
  emissions: string[][],
  initial: string[] = []
): { updates: number; final: string[] } {
  let current = initial;
  let updates = 0;
  for (const emitted of emissions) {
    const next = nextCanvasSelectionIds(current, emitted);
    if (next !== current) {
      updates += 1;
      current = next as string[];
    }
  }
  return { updates, final: current };
}

describe("DI-9.4.4.1 canvas selection stability", () => {
  it("sameCanvasSelectionIds is ordered and referential-safe", () => {
    const a = ["n1", "n2"];
    assert.equal(sameCanvasSelectionIds(a, a), true);
    assert.equal(sameCanvasSelectionIds(a, ["n1", "n2"]), true);
    assert.equal(sameCanvasSelectionIds(a, ["n2", "n1"]), false);
    assert.equal(sameCanvasSelectionIds([], []), true);
    assert.equal(sameCanvasSelectionIds(["n1"], []), false);
  });

  it("repeated identical RF selection emissions do not update state (empty → empty)", () => {
    const { updates, final } = simulateSelectionSync([[], [], [], [], []], []);
    assert.equal(updates, 0);
    assert.deepEqual(final, []);
  });

  it("non-empty focused graph: settle after one real selection, ignore repeats", () => {
    // Representative PERSON-focus board: several factual node ids (depth≥1 scale).
    const boardIds = [
      "b9a6c674-db36-4f40-a7de-4c9a727c37a7",
      "phone-1",
      "sim-1",
      "device-1",
      "case-1",
    ];
    // RF mounts and emits [] a few times, then user selects 3 nodes, then RF
    // re-emits the same selection repeatedly (callback churn / rebuild).
    const emissions = [
      [],
      [],
      boardIds.slice(0, 3),
      boardIds.slice(0, 3),
      boardIds.slice(0, 3),
      boardIds.slice(0, 3),
      [...boardIds.slice(0, 3)], // fresh array, same contents
    ];
    const { updates, final } = simulateSelectionSync(emissions, []);
    assert.equal(updates, 1, `expected exactly one state update, got ${updates}`);
    assert.deepEqual(final, boardIds.slice(0, 3));
  });

  it("real selection changes still update (add / remove / clear)", () => {
    const { updates, final } = simulateSelectionSync(
      [["a"], ["a", "b"], ["a", "b"], ["b"], [], []],
      []
    );
    assert.equal(updates, 4);
    assert.deepEqual(final, []);
  });

  it("mixed factual+annotation partition remains correct after stable sync", () => {
    const ids = ["person-1", "ann-abc", "phone-2"];
    const settled = nextCanvasSelectionIds([], ids);
    const again = nextCanvasSelectionIds(settled, [...ids]);
    assert.equal(again, settled);
    const { factualIds, annotationIds } = partitionBoardSelectionIds(again);
    assert.deepEqual(factualIds, ["person-1", "phone-2"]);
    assert.deepEqual(annotationIds, ["ann-abc"]);
  });

  it("Network page wires equality-guarded selection sync", () => {
    const src = readFileSync(join(process.cwd(), "app/drug-intelligence/network/page.tsx"), "utf8");
    assert.ok(src.includes("nextCanvasSelectionIds"));
    assert.ok(src.includes("handleSelectionChange = useCallback"));
    assert.ok(src.includes("setSelectedCanvasIds((prev) => nextCanvasSelectionIds(prev, ids))"));
  });
});
