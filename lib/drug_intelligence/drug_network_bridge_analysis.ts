/**
 * DI-8.7 V2 — Bridge & Network Structure Intelligence (PATH_BRIDGE only —
 * see the architecture-audit note below for why MULTI_CASE_BRIDGE and
 * CROSS_BRANCH_CONNECTOR are NOT implemented as separate types here).
 *
 * PURE STRUCTURAL ANALYSIS ONLY. No DB calls, no API calls, no React, no
 * side effects, no layout/coordinate dependency. Operates ONLY on the
 * already-loaded, already-bounded DrugGraphNeighborhoodResponse the
 * Network Inspector already has (DRUG_GRAPH_HARD_MAX_NODES=150,
 * DRUG_GRAPH_MAX_DEPTH=2 — see drug_network_graph_types.ts). Zero new
 * queries, zero server aggregation.
 *
 * ARCHITECTURE-AUDIT FINDINGS (Section 2/3 of the V2 prompt):
 *
 * TYPE A (MULTI_CASE_BRIDGE) — NOT implemented as a new type. The
 * existing DI-8.7 V1 `CROSS_CASE_ENTITY` insight (drug_network_graph_
 * insights.ts) is EXACTLY this observation: PERSON/PHONE/SIM/DEVICE/
 * VEHICLE entities directly touching >=2 distinct CASE nodes, with the
 * exact supporting case ids/edges as evidence. Reimplementing it here
 * would be a duplicate engine producing an identical fact for an
 * identical entity+case-set tuple — exactly what Section 6 forbids.
 * MULTI_CASE_BRIDGE is therefore satisfied by CROSS_CASE_ENTITY as-is.
 *
 * TYPE B (CROSS_BRANCH_CONNECTOR) — NOT implemented. Audited every
 * candidate definition of "branch"/"group" in this codebase
 * (GROUP_BY_TYPE / GROUP_BY_HOP layout modes, hop distance from focus,
 * node type) and every one is either (a) a LAYOUT/rendering concept
 * with no semantic meaning (explicitly forbidden as evidence by
 * Section 3), or (b) collapses into "distinct connected CASE count",
 * which is already TYPE A/CROSS_CASE_ENTITY. This domain's graph edges
 * are overwhelmingly CASE-mediated (PERSON_CASE, CASE_PHONE, CASE_SIM,
 * CASE_DEVICE, CASE_VEHICLE, CASE_LOCATION) plus a small set of
 * INFERRED SHARED_* edges between two PERSON nodes — there is no
 * additional stable, non-arbitrary structural partition unit besides
 * "which CASE(s) does this touch," which TYPE A already reports. Per
 * Section 3's explicit instruction, this is reported as a STOP rather
 * than guessed at with an invented "branch" concept.
 *
 * TYPE C (PATH_BRIDGE) — implemented below. A bounded, deterministic
 * approximation over the ALREADY LOADED graph: for every distinct pair
 * of CASE nodes in the loaded neighborhood, find the shortest path
 * between them (reusing the existing shortestUndirectedPath BFS
 * primitive — no second path engine), and count how many times each
 * non-CASE intermediate entity appears as a step on one of those
 * shortest paths. An entity appearing on >=1 such path across >=1 case
 * pair qualifies; the observation reports the exact number of
 * qualifying case-pair paths and, as evidence, the exact case pairs.
 */

import type { DrugGraphNeighborhoodResponse, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import { shortestUndirectedPath } from "@/lib/drug_intelligence/drug_network_graph_readability";

/**
 * Hard cap on the number of intermediate hops considered for a single
 * CASE-pair path (Section 3: "maximum path depth <= existing path
 * engine maximum"). The bounded neighborhood already caps total nodes
 * at 150, but this additionally guards against reporting an
 * operationally meaningless very-long incidental path as a "bridge."
 * 4 non-CASE intermediates (5 hops total) matches the longest path
 * shape realistically produced within a depth-2 neighborhood
 * (CASE -> entity -> CASE -> entity -> CASE).
 */
export const PATH_BRIDGE_MAX_INTERMEDIATE_HOPS = 4;

/**
 * Hard cap on the number of CASE nodes considered for pairwise path
 * analysis (Section 12: "case pair count may be O(C²) only inside the
 * small already-loaded bounded graph, but impose a safe deterministic
 * cap"). With the graph already bounded to <=150 total nodes, the
 * realistic CASE-node count is far smaller than this, but the cap keeps
 * the O(C²) pair enumeration provably safe even in a pathological
 * dataset shape.
 */
export const PATH_BRIDGE_MAX_CASE_NODES = 30;

export interface PathBridgeCasePairEvidence {
  caseAId: string;
  caseBId: string;
  /** The intermediate node ids on the shortest path between this case pair (endpoints excluded). */
  pathNodeIds: string[];
  pathEdgeIds: string[];
}

export interface PathBridgeObservation {
  /** The non-CASE entity that appears as an intermediate step on >=1 qualifying case-pair path. */
  entityId: string;
  /** Distinct qualifying case-pair paths this entity appears on. */
  pathCount: number;
  /** Every qualifying case pair + its exact path, for evidence display — never just a count. */
  supportingPairs: PathBridgeCasePairEvidence[];
  /** Union of every node id across all supporting paths (including this entity and the CASE endpoints), for "ดูบนผัง". */
  supportingNodeIds: string[];
  /** Union of every edge id across all supporting paths, for "ดูบนผัง". */
  supportingEdgeIds: string[];
}

function nodeById(nodes: readonly DrugGraphNode[]): Map<string, DrugGraphNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Computes PATH_BRIDGE observations for the given loaded neighborhood.
 * Deterministic: CASE nodes are sorted by id before pairing, so pair
 * enumeration order (and therefore which shortest path is found when
 * ties exist) never depends on the neighborhood response's own node
 * array order. Never mutates the input.
 */
export function computePathBridgeObservations(
  neighborhood: DrugGraphNeighborhoodResponse,
): PathBridgeObservation[] {
  const byId = nodeById(neighborhood.nodes);
  const caseNodes = neighborhood.nodes
    .filter((n) => n.type === "CASE")
    .map((n) => n.id)
    .sort()
    .slice(0, PATH_BRIDGE_MAX_CASE_NODES);

  if (caseNodes.length < 2) return [];

  const edges = neighborhood.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));

  // entityId -> accumulated observation data
  const byEntity = new Map<string, { pairs: PathBridgeCasePairEvidence[]; nodeIds: Set<string>; edgeIds: Set<string> }>();

  for (let i = 0; i < caseNodes.length; i++) {
    for (let j = i + 1; j < caseNodes.length; j++) {
      const caseAId = caseNodes[i]!;
      const caseBId = caseNodes[j]!;
      const path = shortestUndirectedPath(caseAId, caseBId, edges);
      if (!path) continue;
      // Exclude the two CASE endpoints — only intermediate entities count (Section 3.C "excludes the endpoint CASE nodes").
      const intermediateNodeIds = path.nodeIds.slice(1, -1);
      if (intermediateNodeIds.length === 0) continue; // directly connected cases (no intermediate) — not a path bridge
      if (intermediateNodeIds.length > PATH_BRIDGE_MAX_INTERMEDIATE_HOPS) continue; // bounded path depth
      // Defensive: never count a CASE node reached mid-path as an "intermediate bridge entity" — only true non-CASE entities qualify.
      const qualifyingIntermediates = intermediateNodeIds.filter((id) => byId.get(id)?.type !== "CASE");
      if (qualifyingIntermediates.length === 0) continue;

      for (const entityId of qualifyingIntermediates) {
        const entry = byEntity.get(entityId) ?? { pairs: [], nodeIds: new Set<string>(), edgeIds: new Set<string>() };
        entry.pairs.push({
          caseAId,
          caseBId,
          pathNodeIds: intermediateNodeIds,
          pathEdgeIds: path.edgeIds,
        });
        for (const id of path.nodeIds) entry.nodeIds.add(id);
        for (const id of path.edgeIds) entry.edgeIds.add(id);
        byEntity.set(entityId, entry);
      }
    }
  }

  const out: PathBridgeObservation[] = [];
  for (const [entityId, entry] of byEntity) {
    out.push({
      entityId,
      pathCount: entry.pairs.length,
      supportingPairs: entry.pairs,
      supportingNodeIds: [...entry.nodeIds],
      supportingEdgeIds: [...entry.edgeIds],
    });
  }
  return out;
}
