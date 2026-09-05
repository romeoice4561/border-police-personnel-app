/**
 * Pure hydration: saved board overlay + LIVE factual graph.
 *
 * Live graph wins. Saved state never recreates missing nodes or edges.
 * Labels/masking always come from the live graph response.
 */

import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_network_graph_types";
import type {
  DrugInvestigationBoardAnnotationV1,
  DrugInvestigationBoardEdgeRouteV1,
  DrugInvestigationBoardNodeLayoutV1,
  DrugInvestigationBoardPresentationV1,
  DrugInvestigationBoardStateV1,
} from "@/lib/drug_intelligence/drug_investigation_board_state";

export interface LiveInvestigationGraph {
  nodes: DrugGraphNode[];
  edges: DrugGraphEdge[];
}

export interface BoardReconciliationResult {
  restoredNodeIds: string[];
  orphanedNodeRefs: Array<{ entityType: string; entityId: string; reason: "missing" | "merged" }>;
  remappedMergedNodeIds: Array<{ fromId: string; toId: string }>;
  droppedEdgeRoutes: string[];
  restoredEdgeRoutes: string[];
  restoredAnnotationIds: string[];
}

export interface HydratedInvestigationBoard {
  graph: LiveInvestigationGraph;
  nodeLayout: DrugInvestigationBoardNodeLayoutV1[];
  pinnedNodeIds: string[];
  edgeRoutes: DrugInvestigationBoardEdgeRouteV1[];
  annotations: DrugInvestigationBoardAnnotationV1[];
  presentation: DrugInvestigationBoardPresentationV1;
  reconciliation: BoardReconciliationResult;
}

function canonicalPersonId(node: DrugGraphNode): string {
  if (node.type !== "PERSON") return node.id;
  const meta = node.metadata;
  if (meta.type === "PERSON" && meta.status === "MERGED" && meta.canonicalTarget?.entityId) {
    return meta.canonicalTarget.entityId;
  }
  return node.id;
}

export function hydrateInvestigationBoardState(
  saved: DrugInvestigationBoardStateV1,
  live: LiveInvestigationGraph
): HydratedInvestigationBoard {
  const liveById = new Map(live.nodes.map((n) => [n.id, n]));
  const liveEdgeIds = new Set(live.edges.map((e) => e.id));

  const restoredNodeIds: string[] = [];
  const orphanedNodeRefs: BoardReconciliationResult["orphanedNodeRefs"] = [];
  const remappedMergedNodeIds: BoardReconciliationResult["remappedMergedNodeIds"] = [];
  const appliedLayout: DrugInvestigationBoardNodeLayoutV1[] = [];

  for (const layout of saved.nodeLayout) {
    const liveNode = liveById.get(layout.entityId);
    if (liveNode) {
      const canonical = canonicalPersonId(liveNode);
      if (canonical !== layout.entityId && liveById.has(canonical)) {
        remappedMergedNodeIds.push({ fromId: layout.entityId, toId: canonical });
        appliedLayout.push({ ...layout, entityId: canonical, entityType: "PERSON" });
        restoredNodeIds.push(canonical);
        continue;
      }
      appliedLayout.push({ ...layout, entityType: liveNode.type, entityId: liveNode.id });
      restoredNodeIds.push(liveNode.id);
      continue;
    }

    const remapped = live.nodes.find((n) => canonicalPersonId(n) === layout.entityId || (n.metadata.type === "PERSON" && n.metadata.canonicalTarget?.entityId === layout.entityId));
    if (remapped) {
      remappedMergedNodeIds.push({ fromId: layout.entityId, toId: remapped.id });
      appliedLayout.push({ ...layout, entityType: remapped.type, entityId: remapped.id });
      restoredNodeIds.push(remapped.id);
      continue;
    }

    orphanedNodeRefs.push({
      entityType: layout.entityType,
      entityId: layout.entityId,
      reason: "missing",
    });
  }

  const liveIdSet = new Set(live.nodes.map((n) => n.id));
  const pinnedNodeIds = saved.pinnedNodeIds.filter((id) => liveIdSet.has(id) || appliedLayout.some((n) => n.entityId === id));
  const restoredPins = [...new Set(pinnedNodeIds.filter((id) => liveIdSet.has(id)))];

  const restoredRoutes: DrugInvestigationBoardEdgeRouteV1[] = [];
  const droppedEdgeRoutes: string[] = [];
  for (const route of saved.edgeRoutes) {
    if (liveEdgeIds.has(route.edgeId)) {
      restoredRoutes.push(route);
    } else {
      droppedEdgeRoutes.push(route.edgeId);
    }
  }

  return {
    graph: live,
    nodeLayout: appliedLayout,
    pinnedNodeIds: restoredPins,
    edgeRoutes: restoredRoutes,
    annotations: saved.annotations,
    presentation: saved.presentation,
    reconciliation: {
      restoredNodeIds: [...new Set(restoredNodeIds)],
      orphanedNodeRefs,
      remappedMergedNodeIds,
      droppedEdgeRoutes,
      restoredEdgeRoutes: restoredRoutes.map((r) => r.edgeId),
      restoredAnnotationIds: saved.annotations.map((a) => a.id),
    },
  };
}
