import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeInvestigationBoardState, BoardImageSourceRejectedError } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { drugInvestigationBoardStateV1Schema } from "@/lib/drug_intelligence/drug_investigation_board_api_schemas";
import { hydrateInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_hydrate";
import { sampleLiveGraph, sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";

test("serialize merges geometry, pins, routes, and annotations without factual labels", () => {
  const state = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.nodeLayout.length, 3);
  assert.deepEqual(state.nodeLayout.find((n) => n.entityId === "person-a"), {
    entityType: "PERSON",
    entityId: "person-a",
    x: 100,
    y: 80,
    pinned: true,
  });
  assert.deepEqual(state.pinnedNodeIds, ["person-a"]);
  assert.equal(state.presentation.boardLocked, true);
  assert.deepEqual(state.presentation.viewport, { x: 12, y: -40, zoom: 1.25 });
  assert.equal(state.edgeRoutes.find((r) => r.edgeId === "pc:link-1")?.waypoints.length, 2);
  assert.equal(state.annotations.length, 5);
  assert.equal(JSON.stringify(state).includes("นาย"), false);
  const parsed = drugInvestigationBoardStateV1Schema.safeParse(state);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
});

test("serialize rejects blob/data/http image sources", () => {
  const snap = sampleWorkspaceSnapshot();
  snap.annotations.push({
    id: "ann-img-1",
    type: "IMAGE",
    color: "#000",
    fillColor: "transparent",
    strokeWidth: 1,
    imageSrc: "blob:http://localhost/abc",
    position: { x: 1, y: 1 },
    width: 80,
    height: 60,
  });
  assert.throws(() => serializeInvestigationBoardState(snap), BoardImageSourceRejectedError);
});

test("round-trip serialize → validate → hydrate restores overlay against live graph", () => {
  const state = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const json = JSON.parse(JSON.stringify(state));
  const parsed = drugInvestigationBoardStateV1Schema.parse(json);
  const hydrated = hydrateInvestigationBoardState(parsed, sampleLiveGraph());
  assert.equal(hydrated.nodeLayout.find((n) => n.entityId === "person-a")?.x, 100);
  assert.deepEqual(hydrated.pinnedNodeIds, ["person-a"]);
  assert.equal(hydrated.presentation.boardLocked, true);
  assert.equal(hydrated.presentation.viewport.zoom, 1.25);
  assert.equal(hydrated.edgeRoutes.length, 2);
  assert.equal(hydrated.annotations.find((a) => a.type === "TEXT")?.text, "อาจเป็นผู้ประสาน");
  assert.equal(hydrated.annotations.find((a) => a.type === "RECTANGLE")?.width, 200);
  assert.equal(hydrated.graph.nodes.find((n) => n.id === "person-a")?.label, "นาย ก");
});
