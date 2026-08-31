/**
 * Relationship Search API handlers (Intelligence Search Center Phase 1B).
 * Requires drug.read. Read-only — audit only, no factual writes.
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound, internalError } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission } from "@/lib/auth/roles";
import type { DrugIntelligenceRelationshipQueryService } from "@/lib/drug_intelligence/drug_intelligence_relationship_query_service";
import { drugRelationshipQuerySchema } from "@/lib/drug_intelligence/drug_relationship_query_api_schemas";
import {
  DrugRelationshipQueryEntityNotFoundError,
  DrugRelationshipQueryValidationError,
  type DrugRelationshipQueryResponse,
} from "@/lib/drug_intelligence/drug_relationship_query_types";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

async function resolveCanViewFull(actorId: string): Promise<boolean> {
  const user = await getAuthUserById(actorId);
  return Boolean(user && hasPermission(user.permissions, "drug.edit"));
}

function serializeResponse(result: DrugRelationshipQueryResponse) {
  return {
    ...result,
    results: result.results.map((row) => ({
      ...row,
      firstSeenAt: row.firstSeenAt ? row.firstSeenAt.toISOString() : null,
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    })),
  };
}

/** GET /api/drug-intelligence/search/relationships — bounded Relationship Search. */
export async function handleDrugRelationshipSearch(
  service: DrugIntelligenceRelationshipQueryService,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = drugRelationshipQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid relationship search query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { actorId, actorName, sourceType, sourceId, relationId, targetType, targetId, page, pageSize, dateFrom, dateTo } = parsed.data;

  try {
    const result = await service.query(
      {
        source: { entityType: sourceType, entityId: sourceId },
        relationId,
        target: { entityType: targetType, entityId: targetId ?? null },
        page,
        pageSize,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      { canViewFull: await resolveCanViewFull(actorId), actorId, actorName }
    );
    return jsonOk(serializeResponse(result));
  } catch (error) {
    if (error instanceof DrugRelationshipQueryValidationError) {
      return badRequest(error.message);
    }
    if (error instanceof DrugRelationshipQueryEntityNotFoundError) {
      return notFound("Entity not found");
    }
    return internalError("Failed to run relationship search");
  }
}
