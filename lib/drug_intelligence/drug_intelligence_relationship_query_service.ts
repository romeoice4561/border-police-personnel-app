/**
 * DrugIntelligenceRelationshipQueryService (Intelligence Search Center Phase 1B).
 *
 * Orchestration only: resolves controlled catalog relations against the
 * existing DrugNetworkGraphService (neighborhood + Find Connection path).
 * Never writes factual intelligence; never queries DrugRelationship as truth.
 * QUERY CONDITION ≠ FACT.
 */

import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugNetworkGraphService, DrugPersonGraphNotFoundError, DrugGraphEntityNotFoundError } from "@/lib/drug_intelligence/drug_network_graph_service";
import type { DrugGraphEdge, DrugGraphNode, DrugGraphNodeType } from "@/lib/drug_intelligence/drug_network_graph_types";
import { DRUG_GRAPH_DEFAULT_MAX_NODES, DRUG_GRAPH_HARD_MAX_NODES, DRUG_GRAPH_PATH_MAX_DEPTH } from "@/lib/drug_intelligence/drug_network_graph_types";
import { drugEntityDetailPath, drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { getControlledRelation, isValidRelationCombination } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import {
  DRUG_REL_QUERY_DEFAULT_PAGE_SIZE,
  DRUG_REL_QUERY_HARD_PAGE_SIZE,
  DrugRelationshipQueryEntityNotFoundError,
  DrugRelationshipQueryValidationError,
  type DrugRelationshipQueryEntityRef,
  type DrugRelationshipQueryRequest,
  type DrugRelationshipQueryResponse,
  type DrugRelationshipQueryResultItem,
  type DrugRelationshipQueryServiceOptions,
} from "@/lib/drug_intelligence/drug_relationship_query_types";

function clampPageSize(pageSize: number | undefined): number {
  const raw = pageSize ?? DRUG_REL_QUERY_DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, Math.floor(raw)), DRUG_REL_QUERY_HARD_PAGE_SIZE);
}

function clampPage(page: number | undefined): number {
  return Math.max(1, Math.floor(page ?? 1));
}

function toEntityRef(node: DrugGraphNode): DrugRelationshipQueryEntityRef {
  return {
    entityType: node.type,
    entityId: String(node.id),
    label: node.label,
    secondaryLabel: node.secondaryLabel,
  };
}

function otherEndpoint(edge: DrugGraphEdge, focusId: string): string | null {
  const focus = String(focusId);
  if (String(edge.source) === focus) return String(edge.target);
  if (String(edge.target) === focus) return String(edge.source);
  return null;
}

function timelinePathFor(type: DrugGraphNodeType, id: string): string | null {
  switch (type) {
    case "PERSON":
      return `/drug-intelligence/timeline?focusType=PERSON&focusId=${encodeURIComponent(id)}`;
    case "CASE":
      return `/drug-intelligence/timeline?caseId=${encodeURIComponent(id)}`;
    case "PHONE":
      return `/drug-intelligence/timeline?phoneId=${encodeURIComponent(id)}`;
    case "SIM":
      return `/drug-intelligence/timeline?simId=${encodeURIComponent(id)}`;
    case "DEVICE":
      return `/drug-intelligence/timeline?deviceId=${encodeURIComponent(id)}`;
    case "VEHICLE":
      return `/drug-intelligence/timeline?vehicleId=${encodeURIComponent(id)}`;
    default:
      return null;
  }
}

function mapPathFor(type: DrugGraphNodeType, id: string): string | null {
  if (type === "CASE") return `/drug-intelligence/map?caseId=${encodeURIComponent(id)}`;
  if (type === "PERSON") return `/drug-intelligence/map?personId=${encodeURIComponent(id)}`;
  return null;
}

function detailPathFor(type: DrugGraphNodeType, id: string): string | null {
  if (type === "LOCATION") return null;
  return drugEntityDetailPath(type, id);
}

function buildActions(entity: DrugRelationshipQueryEntityRef): DrugRelationshipQueryResultItem["actions"] {
  return {
    detailPath: detailPathFor(entity.entityType, entity.entityId),
    networkPath: drugNetworkFocusPath(entity.entityType, entity.entityId),
    timelinePath: timelinePathFor(entity.entityType, entity.entityId),
    mapPath: mapPathFor(entity.entityType, entity.entityId),
    expandSource: { entityType: entity.entityType, entityId: entity.entityId, label: entity.label },
  };
}

export class DrugIntelligenceRelationshipQueryService {
  private readonly graph: DrugNetworkGraphService;
  private readonly auditRepo: DrugAuditLogRepository;

  constructor(db: DatabaseClient, graphService?: DrugNetworkGraphService) {
    this.graph = graphService ?? new DrugNetworkGraphService(db);
    this.auditRepo = new DrugAuditLogRepository(db);
  }

  async query(request: DrugRelationshipQueryRequest, options: DrugRelationshipQueryServiceOptions): Promise<DrugRelationshipQueryResponse> {
    const page = clampPage(request.page);
    const pageSize = clampPageSize(request.pageSize);

    const validation = isValidRelationCombination({
      relationId: request.relationId,
      sourceType: request.source.entityType,
      targetType: request.target.entityType,
      targetEntityId: request.target.entityId,
    });
    if (!validation.ok) {
      throw new DrugRelationshipQueryValidationError(validation.reason);
    }
    const relation = validation.relation;

    if (!String(request.source.entityId ?? "").trim()) {
      throw new DrugRelationshipQueryValidationError("Source entity id is required");
    }

    // Keep entity ids as provided for graph lookups. The in-memory test fake
    // assigns numeric ids to some entity tables; coercing to string would
    // break `id === where.id` matching. Production Prisma uses string cuids.
    const normalizedRequest: DrugRelationshipQueryRequest = {
      ...request,
      source: { ...request.source, entityId: request.source.entityId },
      target: {
        ...request.target,
        entityId:
          request.target.entityId != null && String(request.target.entityId).trim()
            ? request.target.entityId
            : null,
      },
    };

    let response: DrugRelationshipQueryResponse;
    try {
      if (relation.queryMode === "PATH") {
        response = await this.queryPath(normalizedRequest, relation.id, page, pageSize, options);
      } else {
        response = await this.queryNeighborhood(normalizedRequest, relation.id, page, pageSize, options);
      }
    } catch (error) {
      if (error instanceof DrugPersonGraphNotFoundError || error instanceof DrugGraphEntityNotFoundError) {
        throw new DrugRelationshipQueryEntityNotFoundError(request.source.entityType, String(request.source.entityId));
      }
      throw error;
    }

    if (options.actorId && options.actorName) {
      await this.auditRepo.record({
        entityType: "DrugRelationshipSearch",
        entityId: "global",
        action: "relationship_search_performed",
        actorId: options.actorId,
        actorName: options.actorName,
        detail: `sourceType=${request.source.entityType} relation=${relation.id} targetType=${request.target.entityType} results=${response.summary.total} truncated=${response.truncated}`,
      });
    }

    return response;
  }

  private async queryNeighborhood(
    request: DrugRelationshipQueryRequest,
    relationId: string,
    page: number,
    pageSize: number,
    options: DrugRelationshipQueryServiceOptions
  ): Promise<DrugRelationshipQueryResponse> {
    const relation = getControlledRelation(relationId)!;
    const depth = relation.neighborhoodDepth;
    const maxNodes = Math.min(DRUG_GRAPH_DEFAULT_MAX_NODES, DRUG_GRAPH_HARD_MAX_NODES);

    // INFERRED SHARED_* edges are derived after DIRECT expansion. Filtering
    // relationshipTypes to SHARED_* during gather would drop the DIRECT
    // junctions needed to build the neighborhood — so only apply the graph
    // relationshipTypes filter for DIRECT catalog entries.
    const relationshipTypes =
      relation.edgeKind === "DIRECT" && relation.graphRelationshipType ? [relation.graphRelationshipType] : undefined;

    const neighborhood = await this.graph.getNeighborhood(
      {
        entityType: request.source.entityType,
        entityId: request.source.entityId,
        depth,
        relationshipTypes,
        nodeTypes: undefined,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        maxNodes,
      },
      { canViewFull: options.canViewFull }
    );

    const focusId = neighborhood.focus.entityId;
    const nodesById = new Map(neighborhood.nodes.map((n) => [String(n.id), n]));
    const focusNode = nodesById.get(String(focusId));
    const focusRef: DrugRelationshipQueryEntityRef = focusNode
      ? toEntityRef(focusNode)
      : { entityType: request.source.entityType, entityId: String(focusId), label: String(focusId), secondaryLabel: null };

    const targetFilterId = request.target.entityId != null && String(request.target.entityId).trim() ? String(request.target.entityId) : null;
    const matched: DrugRelationshipQueryResultItem[] = [];

    for (const edge of neighborhood.edges) {
      if (relation.graphRelationshipType && edge.relationshipType !== relation.graphRelationshipType) continue;
      if (relation.edgeKind === "DIRECT" && edge.edgeKind !== "DIRECT") continue;
      if (relation.edgeKind === "INFERRED" && edge.edgeKind !== "INFERRED") continue;

      const otherId = otherEndpoint(edge, focusId);
      if (!otherId) continue;
      const otherNode = nodesById.get(otherId);
      if (!otherNode) continue;
      if (otherNode.type !== request.target.entityType) continue;
      if (targetFilterId && String(otherNode.id) !== String(targetFilterId)) continue;

      const toRef = toEntityRef(otherNode);
      matched.push({
        resultKind: "EDGE",
        edgeKind: edge.edgeKind,
        relationshipType: edge.relationshipType,
        relationId,
        from: focusRef,
        to: toRef,
        evidenceCount: edge.evidenceCount,
        sourceCaseIds: edge.sourceCaseIds,
        firstSeenAt: edge.firstSeenAt,
        lastSeenAt: edge.lastSeenAt,
        explanation: edge.explanation,
        actions: buildActions(toRef),
      });
    }

    // Stable order: newest lastSeen first, then label
    matched.sort((a, b) => {
      const aTime = a.lastSeenAt?.getTime() ?? a.firstSeenAt?.getTime() ?? 0;
      const bTime = b.lastSeenAt?.getTime() ?? b.firstSeenAt?.getTime() ?? 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.to.label.localeCompare(b.to.label, "th");
    });

    const total = matched.length;
    const start = (page - 1) * pageSize;
    const pageRows = matched.slice(start, start + pageSize);
    const byTargetType: Partial<Record<DrugGraphNodeType, number>> = {};
    for (const row of matched) {
      byTargetType[row.to.entityType] = (byTargetType[row.to.entityType] ?? 0) + 1;
    }

    return {
      interpretation: {
        kind: "QUERY",
        source: { entityType: request.source.entityType, entityId: focusId },
        relationId,
        target: { entityType: request.target.entityType, entityId: targetFilterId },
      },
      summary: { total, byTargetType, found: total > 0 },
      results: pageRows,
      truncated: neighborhood.truncated || total > page * pageSize,
      bounds: { page, pageSize, maxNodes, depth },
    };
  }

  private async queryPath(
    request: DrugRelationshipQueryRequest,
    relationId: string,
    page: number,
    pageSize: number,
    options: DrugRelationshipQueryServiceOptions
  ): Promise<DrugRelationshipQueryResponse> {
    const targetId = request.target.entityId != null ? String(request.target.entityId).trim() : "";
    if (!targetId) {
      throw new DrugRelationshipQueryValidationError("Target entity required for path query");
    }

    const pathResult = await this.graph.findPaths(
      {
        fromType: request.source.entityType,
        fromId: request.source.entityId,
        toType: request.target.entityType,
        toId: targetId,
        maxDepth: DRUG_GRAPH_PATH_MAX_DEPTH,
      },
      { canViewFull: options.canViewFull }
    );

    if (!pathResult.found || pathResult.paths.length === 0) {
      const empty: DrugRelationshipQueryResponse = {
        interpretation: {
          kind: "QUERY",
          source: { entityType: request.source.entityType, entityId: request.source.entityId },
          relationId,
          target: { entityType: request.target.entityType, entityId: targetId },
        },
        summary: { total: 0, byTargetType: {}, found: false },
        results: [],
        truncated: false,
        bounds: { page, pageSize, maxNodes: DRUG_GRAPH_DEFAULT_MAX_NODES, depth: DRUG_GRAPH_PATH_MAX_DEPTH },
      };
      return empty;
    }

    const path = pathResult.paths[0]!;
    const fromNode = path.steps[0]!.node;
    const toNode = path.steps[path.steps.length - 1]!.node;
    const fromRef = toEntityRef(fromNode);
    const toRef = toEntityRef(toNode);

    const item: DrugRelationshipQueryResultItem = {
      resultKind: "PATH",
      edgeKind: "PATH",
      relationshipType: null,
      relationId,
      from: fromRef,
      to: toRef,
      evidenceCount: Math.max(0, path.hopCount),
      sourceCaseIds: [
        ...new Set(
          path.steps
            .flatMap((s) => s.viaEdge?.sourceCaseIds ?? [])
            .filter(Boolean)
        ),
      ],
      firstSeenAt: null,
      lastSeenAt: null,
      explanation: { kind: "PATH", hopCount: path.hopCount },
      pathSteps: path.steps.map((step) => ({
        entity: toEntityRef(step.node),
        viaRelationshipType: step.viaEdge?.relationshipType ?? null,
        viaEdgeKind: step.viaEdge?.edgeKind ?? null,
      })),
      actions: buildActions(toRef),
    };

    return {
      interpretation: {
        kind: "QUERY",
        source: { entityType: request.source.entityType, entityId: fromRef.entityId },
        relationId,
        target: { entityType: request.target.entityType, entityId: targetId },
      },
      summary: { total: 1, byTargetType: { [toRef.entityType]: 1 }, found: true },
      results: page === 1 ? [item] : [],
      truncated: false,
      bounds: { page, pageSize, maxNodes: DRUG_GRAPH_DEFAULT_MAX_NODES, depth: DRUG_GRAPH_PATH_MAX_DEPTH },
    };
  }
}
