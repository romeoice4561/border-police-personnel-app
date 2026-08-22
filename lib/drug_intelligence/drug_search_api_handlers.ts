/**
 * Drug Intelligence Global Search API handlers (Phase DI-3).
 *
 * Same framework-agnostic handler pattern as drug_person_api_handlers.ts —
 * reuses `assertDrugIntelligencePermission` rather than re-implementing the
 * cookie/actor/permission check. Every search endpoint requires `drug.read`
 * (Section 3/27 — the same minimum bar as viewing anything else in this
 * module; search is a read operation, never a stricter gate than the data
 * it surfaces already has).
 *
 * Search audit (Section 28): the search service itself (not this handler
 * layer, matching every other DI-1/DI-2 service's own-audit-repo
 * convention) writes ONE `DrugAuditLog` row per grouped search — action
 * `search_performed`, detail carries the query CLASSIFICATION and result
 * COUNT only, never the raw query text (a search query may itself be a
 * national ID or phone number, so it is never logged verbatim).
 */

import { z } from "zod";
import { badRequest, jsonOk } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import { drugSearchGroupedQuerySchema, drugSearchByTypeQuerySchema } from "@/lib/drug_intelligence/drug_search_api_schemas";
import type { DrugSearchFilters } from "@/lib/drug_intelligence/drug_search_types";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission } from "@/lib/auth/roles";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function extractFilters(data: {
  entityType?: "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE";
  dateFrom?: string;
  dateTo?: string;
  province?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  minCaseCount?: number;
}): DrugSearchFilters {
  return {
    entityType: data.entityType,
    dateFrom: data.dateFrom ? new Date(data.dateFrom) : undefined,
    dateTo: data.dateTo ? new Date(data.dateTo) : undefined,
    province: data.province,
    headquartersId: data.headquartersId,
    regionId: data.regionId,
    battalionId: data.battalionId,
    companyId: data.companyId,
    minCaseCount: data.minCaseCount,
  };
}

/** GET /api/drug-intelligence/search — Section 3's grouped Global Search overview. Requires drug.read. */
export async function handleDrugSearchGrouped(service: DrugIntelligenceSearchService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugSearchGroupedQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid search query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { actorId, actorName, q, perGroupLimit, ...filterFields } = parsed.data;
  const filters = extractFilters(filterFields);

  const result = await service.searchGrouped(
    { query: q, filters, perGroupLimit },
    { canViewFull: await resolveCanViewFull(actorId), actorId, actorName }
  );

  return jsonOk(result);
}

/** GET /api/drug-intelligence/search/by-type — Section 24's single-entity-type paginated drill-in. Requires drug.read. */
export async function handleDrugSearchByType(service: DrugIntelligenceSearchService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugSearchByTypeQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid search query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { actorId, q, entityType, page, pageSize, ...filterFields } = parsed.data;
  const filters = extractFilters({ ...filterFields, entityType });

  const result = await service.searchByType({ query: q, entityType, filters, page, pageSize }, { canViewFull: await resolveCanViewFull(actorId) });
  return jsonOk(result.rows, { page, pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) });
}

/**
 * Resolves whether `actorId` may view full sensitive values — mirrors every
 * other DI-2/DI-3 call site's `can("drug.edit")` gate, but this module's
 * handlers only have the raw actor id (not a resolved AuthUser) at this
 * point, so it re-resolves the same way assertDrugIntelligencePermission
 * does internally.
 */
async function resolveCanViewFull(actorId: string): Promise<boolean> {
  const user = await getAuthUserById(actorId);
  return Boolean(user && hasPermission(user.permissions, "drug.edit"));
}
