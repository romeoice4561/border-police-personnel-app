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
import { DRUG_GRAPH_DEFAULT_MAX_NODES, DRUG_GRAPH_HARD_MAX_NODES, DRUG_REL_SEARCH_MAX_PATHS, DRUG_REL_SEARCH_PATH_MAX_DEPTH } from "@/lib/drug_intelligence/drug_network_graph_types";
import { drugEntityDetailPath, drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { getControlledRelation, isValidRelationCombination } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import {
  DRUG_REL_QUERY_DEFAULT_PAGE_SIZE,
  DRUG_REL_QUERY_HARD_PAGE_SIZE,
  DrugRelationshipQueryEntityNotFoundError,
  DrugRelationshipQueryValidationError,
  type DrugRelationshipQueryCaseSummary,
  type DrugRelationshipQueryEntityRef,
  type DrugRelationshipQueryRequest,
  type DrugRelationshipQueryResponse,
  type DrugRelationshipQueryResultItem,
  type DrugRelationshipQueryServiceOptions,
} from "@/lib/drug_intelligence/drug_relationship_query_types";
import { sortCasesChronologically, toDateOnly } from "@/lib/drug_intelligence/drug_cross_case_connection";
import { parseThaiClockHhMm } from "@/lib/drug_intelligence/di_date_helpers";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";

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
  private readonly caseRepo: DrugCaseRepository;

  constructor(db: DatabaseClient, graphService?: DrugNetworkGraphService) {
    this.graph = graphService ?? new DrugNetworkGraphService(db);
    this.auditRepo = new DrugAuditLogRepository(db);
    this.caseRepo = new DrugCaseRepository(db);
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
    /** DI-8.3 — “ความเกี่ยวข้องทั้งหมด”: neighborhood with no single relationshipType filter. */
    const isAllRelated = relation.queryMode === "NEIGHBORHOOD" && relation.graphRelationshipType == null;

    // INFERRED SHARED_* edges are derived after DIRECT expansion. Filtering
    // relationshipTypes to SHARED_* during gather would drop the DIRECT
    // junctions needed to build the neighborhood — so only apply the graph
    // relationshipTypes filter for DIRECT catalog entries.
    const relationshipTypes =
      !isAllRelated && relation.edgeKind === "DIRECT" && relation.graphRelationshipType
        ? [relation.graphRelationshipType]
        : undefined;

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
    const allowedTargetTypes = new Set(relation.targetTypes);

    for (const edge of neighborhood.edges) {
      if (!isAllRelated) {
        if (relation.graphRelationshipType && edge.relationshipType !== relation.graphRelationshipType) continue;
        if (relation.edgeKind === "DIRECT" && edge.edgeKind !== "DIRECT") continue;
        if (relation.edgeKind === "INFERRED" && edge.edgeKind !== "INFERRED") continue;
      }

      const otherId = otherEndpoint(edge, focusId);
      if (!otherId) continue;
      const otherNode = nodesById.get(otherId);
      if (!otherNode) continue;
      if (isAllRelated) {
        if (!allowedTargetTypes.has(otherNode.type)) continue;
        if (targetFilterId && String(otherNode.id) !== String(targetFilterId)) continue;
      } else {
        if (otherNode.type !== request.target.entityType) continue;
        if (targetFilterId && String(otherNode.id) !== String(targetFilterId)) continue;
      }

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
    await this.attachRelatedCases(pageRows);
    const byTargetType: Partial<Record<DrugGraphNodeType, number>> = {};
    for (const row of matched) {
      byTargetType[row.to.entityType] = (byTargetType[row.to.entityType] ?? 0) + 1;
    }
    const relatedCaseIds = new Set<string>();
    for (const row of matched) for (const id of row.sourceCaseIds) relatedCaseIds.add(id);

    return {
      interpretation: {
        kind: "QUERY",
        source: { entityType: request.source.entityType, entityId: focusId },
        relationId,
        target: { entityType: request.target.entityType, entityId: targetFilterId },
      },
      summary: { total, byTargetType, found: total > 0, relatedCaseCount: relatedCaseIds.size },
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
        maxDepth: DRUG_REL_SEARCH_PATH_MAX_DEPTH,
        maxPaths: DRUG_REL_SEARCH_MAX_PATHS,
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
        summary: { total: 0, byTargetType: {}, found: false, relatedCaseCount: 0 },
        results: [],
        truncated: Boolean(pathResult.truncated),
        bounds: { page, pageSize, maxNodes: DRUG_GRAPH_DEFAULT_MAX_NODES, depth: DRUG_REL_SEARCH_PATH_MAX_DEPTH },
      };
      return empty;
    }

    const items: DrugRelationshipQueryResultItem[] = pathResult.paths.map((path, pathIndex) => {
      const fromNode = path.steps[0]!.node;
      const toNode = path.steps[path.steps.length - 1]!.node;
      const fromRef = toEntityRef(fromNode);
      const toRef = toEntityRef(toNode);
      return {
        resultKind: "PATH" as const,
        edgeKind: "PATH" as const,
        relationshipType: null,
        relationId,
        from: fromRef,
        to: toRef,
        evidenceCount: Math.max(0, path.hopCount),
        sourceCaseIds: [
          ...new Set(path.steps.flatMap((s) => s.viaEdge?.sourceCaseIds ?? []).filter(Boolean)),
        ],
        firstSeenAt: null,
        lastSeenAt: null,
        explanation: { kind: "PATH" as const, hopCount: path.hopCount, pathIndex: pathIndex + 1 },
        pathSteps: path.steps.map((step) => ({
          entity: toEntityRef(step.node),
          viaRelationshipType: step.viaEdge?.relationshipType ?? null,
          viaEdgeKind: step.viaEdge?.edgeKind ?? null,
        })),
        actions: buildActions(toRef),
      };
    });

    await this.attachRelatedCases(items);

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pageRows = items.slice(start, start + pageSize);
    const relatedCaseIds = new Set<string>();
    for (const row of items) for (const id of row.sourceCaseIds) relatedCaseIds.add(id);

    return {
      interpretation: {
        kind: "QUERY",
        source: { entityType: request.source.entityType, entityId: items[0]!.from.entityId },
        relationId,
        target: { entityType: request.target.entityType, entityId: targetId },
      },
      summary: {
        total,
        byTargetType: { [items[0]!.to.entityType]: total },
        found: true,
        relatedCaseCount: relatedCaseIds.size,
      },
      results: pageRows,
      truncated: Boolean(pathResult.truncated) || total > page * pageSize,
      bounds: { page, pageSize, maxNodes: DRUG_GRAPH_DEFAULT_MAX_NODES, depth: DRUG_REL_SEARCH_PATH_MAX_DEPTH },
    };
  }

  private async attachRelatedCases(rows: DrugRelationshipQueryResultItem[]): Promise<void> {
    const ids = [...new Set(rows.flatMap((r) => r.sourceCaseIds))];
    if (ids.length === 0) {
      for (const row of rows) row.relatedCases = [];
      return;
    }
    const cases = (await this.caseRepo.findByIds(ids)) as Array<{
      id: string;
      caseNumber: string;
      arrestDate: Date | string | null;
      arrestTime?: string | null;
      province: string | null;
      district?: string | null;
    }>;
    const byId = new Map(
      cases.map((c) => {
        const summary: DrugRelationshipQueryCaseSummary = {
          caseId: c.id,
          caseNumber: c.caseNumber,
          arrestDate: toDateOnly(c.arrestDate),
          arrestTime: parseThaiClockHhMm(c.arrestTime ?? null),
          province: c.province,
          district: c.district ?? null,
        };
        return [c.id, summary] as const;
      }),
    );
    for (const row of rows) {
      const list = row.sourceCaseIds.map((id) => byId.get(id)).filter((c): c is DrugRelationshipQueryCaseSummary => Boolean(c));
      row.relatedCases = sortCasesChronologically(
        list.map((c) => ({
          caseId: c.caseId,
          caseNumber: c.caseNumber,
          arrestDate: c.arrestDate,
          arrestTime: c.arrestTime,
        })),
      ).map((ordered) => byId.get(ordered.caseId)!);
    }
  }
}
