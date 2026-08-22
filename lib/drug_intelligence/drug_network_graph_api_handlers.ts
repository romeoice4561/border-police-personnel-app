/**
 * Drug Intelligence Network Graph API handlers (Phase DI-5, Section 6).
 *
 * Same framework-agnostic handler pattern as drug_search_api_handlers.ts —
 * reuses `assertDrugIntelligencePermission` (drug.read minimum). Never
 * leaks a raw DB object to the client — every node/edge already went
 * through DrugNetworkGraphService's typed contract before reaching here;
 * this layer only converts Date -> ISO string for JSON transport.
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound, internalError } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { DrugPersonGraphNotFoundError, DrugGraphEntityNotFoundError, type DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import { drugGraphNeighborhoodQuerySchema, drugGraphPathQuerySchema } from "@/lib/drug_intelligence/drug_network_graph_api_schemas";
import type { DrugGraphNode, DrugGraphEdge, DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_network_graph_types";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission } from "@/lib/auth/roles";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

async function resolveCanViewFull(actorId: string): Promise<boolean> {
  const user = await getAuthUserById(actorId);
  return Boolean(user && hasPermission(user.permissions, "drug.edit"));
}

function serializeNode(node: DrugGraphNode) {
  return {
    ...node,
    firstSeenAt: node.firstSeenAt ? node.firstSeenAt.toISOString() : null,
    lastSeenAt: node.lastSeenAt ? node.lastSeenAt.toISOString() : null,
    metadata: node.metadata.type === "CASE" ? { ...node.metadata, arrestDate: node.metadata.arrestDate ? node.metadata.arrestDate.toISOString() : null } : node.metadata,
  };
}

function serializeEdge(edge: DrugGraphEdge) {
  return {
    ...edge,
    firstSeenAt: edge.firstSeenAt ? edge.firstSeenAt.toISOString() : null,
    lastSeenAt: edge.lastSeenAt ? edge.lastSeenAt.toISOString() : null,
  };
}

/** GET /api/drug-intelligence/network — Section 4's bounded neighborhood expansion. Requires drug.read. */
export async function handleDrugGraphNeighborhood(service: DrugNetworkGraphService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugGraphNeighborhoodQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid network query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { actorId, entityType, entityId, depth, nodeTypes, relationshipTypes, dateFrom, dateTo, maxNodes } = parsed.data;

  try {
    const result = await service.getNeighborhood(
      {
        entityType,
        entityId,
        depth: depth as 1 | 2,
        nodeTypes: nodeTypes as DrugGraphNodeType[] | undefined,
        relationshipTypes: relationshipTypes as DrugGraphRelationshipType[] | undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        maxNodes,
      },
      { canViewFull: await resolveCanViewFull(actorId) }
    );
    return jsonOk({
      focus: result.focus,
      nodes: result.nodes.map(serializeNode),
      edges: result.edges.map(serializeEdge),
      truncated: result.truncated,
    });
  } catch (error) {
    if (error instanceof DrugPersonGraphNotFoundError || error instanceof DrugGraphEntityNotFoundError) {
      return notFound("Entity not found");
    }
    return internalError("Failed to load network");
  }
}

/** GET /api/drug-intelligence/network/path — Section 5's bounded path finding. Requires drug.read. */
export async function handleDrugGraphPath(service: DrugNetworkGraphService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugGraphPathQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid path query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { actorId, fromType, fromId, toType, toId, maxDepth } = parsed.data;

  try {
    const result = await service.findPaths({ fromType, fromId, toType, toId, maxDepth }, { canViewFull: await resolveCanViewFull(actorId) });
    return jsonOk({
      found: result.found,
      paths: result.paths.map((path) => ({
        hopCount: path.hopCount,
        steps: path.steps.map((step) => ({
          node: serializeNode(step.node),
          viaEdge: step.viaEdge ? serializeEdge(step.viaEdge) : null,
        })),
      })),
    });
  } catch (error) {
    if (error instanceof DrugPersonGraphNotFoundError || error instanceof DrugGraphEntityNotFoundError) {
      return notFound("Entity not found");
    }
    return internalError("Failed to find path");
  }
}
