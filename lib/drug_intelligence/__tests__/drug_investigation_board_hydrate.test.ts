import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { hydrateInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_hydrate";
import { sampleLiveGraph, sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";

test("missing DIRECT edge drops its route and does not recreate the edge", () => {
  const saved = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const live = sampleLiveGraph({ dropDirect: true });
  const hydrated = hydrateInvestigationBoardState(saved, live);
  assert.ok(hydrated.reconciliation.droppedEdgeRoutes.includes("pc:link-1"));
  assert.equal(live.edges.some((e) => e.id === "pc:link-1"), false);
  assert.equal(hydrated.graph.edges.some((e) => e.id === "pc:link-1"), false);
});

test("missing INFERRED edge prunes its route", () => {
  const saved = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const hydrated = hydrateInvestigationBoardState(saved, sampleLiveGraph({ dropInferred: true }));
  assert.ok(hydrated.reconciliation.droppedEdgeRoutes.includes("inf:SHARED_CASE:person-a:person-b"));
  assert.equal(hydrated.edgeRoutes.some((r) => r.edgeId.startsWith("inf:")), false);
});

test("live labels win when the saved overlay is reopened", () => {
  const saved = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const hydrated = hydrateInvestigationBoardState(saved, sampleLiveGraph({ relabel: true }));
  assert.equal(hydrated.graph.nodes.find((n) => n.id === "person-a")?.label, "นาย ก (อัปเดต)");
});

test("live masking wins for phone nodes", () => {
  const saved = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const hydrated = hydrateInvestigationBoardState(saved, sampleLiveGraph({ maskPhone: true }));
  const phone = hydrated.graph.nodes.find((n) => n.id === "phone-1");
  assert.equal(phone?.label, "08x-xxx-1234");
  assert.equal(phone?.maskedLabel, "08x-xxx-1234");
});

test("missing factual entity is orphaned — no fabricated node", () => {
  const saved = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const hydrated = hydrateInvestigationBoardState(saved, sampleLiveGraph({ missingPersonB: true }));
  assert.ok(hydrated.reconciliation.orphanedNodeRefs.some((o) => o.entityId === "person-b"));
  assert.equal(hydrated.graph.nodes.some((n) => n.id === "person-b"), false);
  assert.equal(hydrated.nodeLayout.some((n) => n.entityId === "person-b"), false);
});

test("merged person remaps layout onto canonical target when present", () => {
  const saved = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const hydrated = hydrateInvestigationBoardState(saved, sampleLiveGraph({ mergePersonA: true }));
  assert.ok(hydrated.reconciliation.remappedMergedNodeIds.some((m) => m.fromId === "person-a" && m.toId === "person-survivor"));
  assert.ok(hydrated.nodeLayout.some((n) => n.entityId === "person-survivor"));
  assert.equal(hydrated.graph.nodes.some((n) => n.id === "person-survivor"), true);
});
