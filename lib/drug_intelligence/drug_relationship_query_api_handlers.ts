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
import type { DrugEntityMediaService } from "@/lib/drug_intelligence/drug_entity_media_service";
import { visualLookupKey } from "@/lib/drug_intelligence/drug_entity_media_types";
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
  request: Request,
  media?: DrugEntityMediaService | null
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
    const serialized = serializeResponse(result);
    if (!media) return jsonOk(serialized);
    try {
      const refs = serialized.results.flatMap((row) => [
        { entityType: row.from.entityType, entityId: row.from.entityId },
        { entityType: row.to.entityType, entityId: row.to.entityId },
        ...(row.pathSteps ?? []).map((step) => ({ entityType: step.entity.entityType, entityId: step.entity.entityId })),
      ]);
      const visuals = await media.visualsFor(refs);
      return jsonOk({
        ...serialized,
        results: serialized.results.map((row) => ({
          ...row,
          from: { ...row.from, visual: visuals.get(visualLookupKey(row.from.entityType, row.from.entityId)) ?? null },
          to: { ...row.to, visual: visuals.get(visualLookupKey(row.to.entityType, row.to.entityId)) ?? null },
          pathSteps: row.pathSteps?.map((step) => ({
            ...step,
            entity: {
              ...step.entity,
              visual: visuals.get(visualLookupKey(step.entity.entityType, step.entity.entityId)) ?? null,
            },
          })),
        })),
      });
    } catch (error) {
      console.error("entity media relationship visual attach failed", error instanceof Error ? error.name : "unknown");
      return jsonOk(serialized);
    }
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

/** POST /api/drug-intelligence/search/relationships — same contract as GET (DI-8.3). */
export async function handleDrugRelationshipSearchPost(
  service: DrugIntelligenceRelationshipQueryService,
  request: Request,
  media?: DrugEntityMediaService | null
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!body || typeof body !== "object") return badRequest("Invalid relationship search body");

  const raw = body as Record<string, unknown>;
  const source = raw.source && typeof raw.source === "object" ? (raw.source as Record<string, unknown>) : {};
  const target = raw.target && typeof raw.target === "object" ? (raw.target as Record<string, unknown>) : {};
  const flattened = {
    actorId: raw.actorId,
    actorName: raw.actorName,
    sourceType: source.type ?? source.entityType ?? raw.sourceType,
    sourceId: source.id ?? source.entityId ?? raw.sourceId,
    relationId: raw.relationId ?? raw.relationshipType,
    targetType: target.type ?? target.entityType ?? raw.targetType,
    targetId: target.id ?? target.entityId ?? raw.targetId,
    page: raw.page,
    pageSize: raw.pageSize,
    dateFrom: raw.dateFrom,
    dateTo: raw.dateTo,
  };

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(flattened)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  return handleDrugRelationshipSearch(service, params, request, media);
}
