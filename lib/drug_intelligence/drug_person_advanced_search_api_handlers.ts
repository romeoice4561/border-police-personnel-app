/**
 * Drug Intelligence Advanced Person Search API handler (Phase DI-7.4).
 *
 * Framework-agnostic handler: takes a DatabaseClient + URLSearchParams +
 * Request, returns a Web Response. Reuses the same patterns as the existing
 * Drug Intelligence handlers (assertDrugIntelligencePermission, jsonOk,
 * badRequest, zodDetails) so the new endpoint is consistent with the rest
 * of the module.
 *
 * Permission: drug.read — same gate as the Person Directory (Section 7-9).
 * Audit: records a single "person_search" log with resultCount only (NOT
 * the raw query text, which may contain sensitive partial identifiers).
 */

import { z } from "zod";
import { badRequest, jsonOk } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { drugPersonAdvancedSearchSchema } from "@/lib/drug_intelligence/drug_person_advanced_search_api_schemas";
import { DrugPersonAdvancedSearchService } from "@/lib/drug_intelligence/drug_person_advanced_search_service";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import type { DatabaseClient } from "@/lib/database/database_types";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * GET /api/drug-intelligence/persons/search
 *
 * Advanced multi-criteria person search (DI-7.4). Requires drug.read.
 * All filter parameters are optional; absence = no restriction on that field.
 */
export async function handleDrugPersonAdvancedSearch(
  db: DatabaseClient,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = drugPersonAdvancedSearchSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid advanced search query", zodDetails(parsed.error));

  const { actorId, page, pageSize, sort, ...filterFields } = parsed.data;

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  const service = new DrugPersonAdvancedSearchService(db);
  const result = await service.search({ ...filterFields, sort, page, pageSize }, actorId);

  // Audit: log the search action with result count only (no raw query text).
  await new DrugAuditLogRepository(db).record({
    entityType: "DrugPerson",
    entityId: "search",
    action: "person_search",
    actorId,
    actorName: actorId,
    detail: JSON.stringify({ resultCount: result.total }),
  });

  return jsonOk(result.items, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
}
