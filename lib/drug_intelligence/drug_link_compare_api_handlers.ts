/**
 * Link Compare API handlers (LC-2A).
 *
 * GET /api/drug-intelligence/network/compare — read-only QUERY analysis.
 * Requires drug.read. Masking follows existing graph/path rules (canViewFull = drug.edit).
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound, internalError } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission } from "@/lib/auth/roles";
import { DrugPersonGraphNotFoundError, DrugGraphEntityNotFoundError } from "@/lib/drug_intelligence/drug_network_graph_service";
import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_network_graph_types";
import { drugLinkCompareQuerySchema } from "@/lib/drug_intelligence/drug_link_compare_api_schemas";
import { DrugLinkCompareService } from "@/lib/drug_intelligence/drug_link_compare_service";
import { DrugLinkCompareValidationError, type DrugLinkCompareResult, type DrugLinkCompareSlotInput } from "@/lib/drug_intelligence/drug_link_compare_types";

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

function serializeResult(result: DrugLinkCompareResult) {
  return {
    ...result,
    pairs: result.pairs.map((pair) => ({
      ...pair,
      shortestPath: pair.shortestPath
        ? {
            hopCount: pair.shortestPath.hopCount,
            steps: pair.shortestPath.steps.map((step) => ({
              node: serializeNode(step.node),
              viaEdge: step.viaEdge ? serializeEdge(step.viaEdge) : null,
            })),
          }
        : null,
    })),
  };
}

/** GET /api/drug-intelligence/network/compare */
export async function handleDrugLinkCompare(
  service: DrugLinkCompareService,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = drugLinkCompareQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid compare query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { actorId, aType, aId, bType, bId, cType, cId } = parsed.data;
  const slots: DrugLinkCompareSlotInput[] = [
    { key: "A", kind: "DATABASE", entityType: aType, entityId: aId },
    { key: "B", kind: "DATABASE", entityType: bType, entityId: bId },
  ];
  if (cType && cId) {
    slots.push({ key: "C", kind: "DATABASE", entityType: cType, entityId: cId });
  }

  try {
    const result = await service.compare({ slots }, { canViewFull: await resolveCanViewFull(actorId) });
    return jsonOk(serializeResult(result));
  } catch (error) {
    if (error instanceof DrugLinkCompareValidationError) {
      return badRequest(error.message, { code: error.code });
    }
    if (error instanceof DrugPersonGraphNotFoundError || error instanceof DrugGraphEntityNotFoundError) {
      return notFound("Entity not found");
    }
    return internalError("Failed to compare entities");
  }
}
