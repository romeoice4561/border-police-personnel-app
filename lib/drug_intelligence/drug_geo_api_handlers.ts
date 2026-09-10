/**
 * Drug Geo / Map Intelligence API handlers.
 *
 * LIVE GET /api/drug-intelligence/map (DI-10E.6B) uses DrugMapQueryService.
 * handleDrugGeoResult remains for the legacy loader and is not the live path.
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import type { DrugGeoIntelligenceService } from "@/lib/drug_intelligence/drug_geo_intelligence_service";
import { drugGeoQuerySchema, drugMapQuerySchema } from "@/lib/drug_intelligence/drug_case_api_schemas";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import {
  DrugMapQueryInvalidFilterError,
  DrugMapQueryService,
  type DrugMapQueryInput,
} from "@/lib/drug_intelligence/drug_map_query";
import {
  DrugMapCaseDetailInvalidIdError,
  DrugMapCaseDetailService,
} from "@/lib/drug_intelligence/drug_map_case_detail";
import { DrugCaseNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import { mapListTotalPages } from "@/lib/drug_intelligence/drug_map_view";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * Legacy unbounded loader. Not used by GET /api/drug-intelligence/map.
 * Retained so existing getGeoResult tests can still exercise the old handler.
 */
export async function handleDrugGeoResult(service: DrugGeoIntelligenceService, searchParams: URLSearchParams, actorId: string | null, rawHeaders: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(rawHeaders, actorId, "drug.read");
  if (denied) return denied;

  const queryParsed = drugGeoQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) return badRequest("Invalid map query", zodDetails(queryParsed.error));

  const { arrestDateFrom, arrestDateTo, ...rest } = queryParsed.data;
  const result = await service.getGeoResult({
    page: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
    ...rest,
    arrestDateFrom: arrestDateFrom ? new Date(arrestDateFrom) : undefined,
    arrestDateTo: arrestDateTo ? new Date(arrestDateTo) : undefined,
  });

  return jsonOk(result);
}

/** LIVE GET /api/drug-intelligence/map — bounded Map V2. */
export async function handleDrugMapQuery(service: DrugMapQueryService, searchParams: URLSearchParams, actorId: string | null, rawHeaders: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(rawHeaders, actorId, "drug.read");
  if (denied) return denied;

  const queryParsed = drugMapQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) return badRequest("Invalid map query", zodDetails(queryParsed.error));

  const parsed = queryParsed.data;
  const input: DrugMapQueryInput = {
    dateFrom: parsed.dateFrom || parsed.arrestDateFrom,
    dateTo: parsed.dateTo || parsed.arrestDateTo,
    status: parsed.status,
    drugCategory: parsed.drugCategory,
    province: parsed.province,
    district: parsed.district,
    headquartersId: parsed.headquartersId,
    regionId: parsed.regionId,
    battalionId: parsed.battalionId,
    companyId: parsed.companyId,
    leadHeadquartersId: parsed.leadHeadquartersId,
    leadRegionId: parsed.leadRegionId,
    leadBattalionId: parsed.leadBattalionId,
    leadCompanyId: parsed.leadCompanyId,
    personId: parsed.personId,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };

  try {
    const result = await service.load(input);
    return jsonOk({
      ...result,
      list: {
        ...result.list,
        totalPages: mapListTotalPages(result.list.total, result.list.pageSize),
      },
    });
  } catch (error) {
    if (error instanceof DrugMapQueryInvalidFilterError) {
      return badRequest("Invalid map query");
    }
    return jsonError("INTERNAL_ERROR", "Failed to load map query", 500);
  }
}

/** LIVE GET /api/drug-intelligence/map/cases/{caseId} — one-case Map popup detail. */
export async function handleDrugMapCaseDetail(
  service: DrugMapCaseDetailService,
  caseId: string,
  actorId: string | null,
  rawHeaders: Request
): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(rawHeaders, actorId, "drug.read");
  if (denied) return denied;

  try {
    const result = await service.load(caseId);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof DrugMapCaseDetailInvalidIdError) {
      return badRequest("Invalid map case id");
    }
    if (error instanceof DrugCaseNotFoundError) {
      return notFound(error.message);
    }
    return jsonError("INTERNAL_ERROR", "Failed to load map case detail", 500);
  }
}
