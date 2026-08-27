/**
 * Drug Geo Intelligence API handler (Phase DI-8, Section 32/33).
 *
 * GET /api/drug-intelligence/map — drug.read gated, same
 * assertDrugIntelligencePermission convention every other Drug Intelligence
 * endpoint uses. One request assembles the full map/list/no-coordinate/
 * province-breakdown payload (Section 32: "do not make the browser
 * assemble map markers from many API calls").
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk } from "@/lib/api/api_response";
import type { DrugGeoIntelligenceService } from "@/lib/drug_intelligence/drug_geo_intelligence_service";
import { drugGeoQuerySchema } from "@/lib/drug_intelligence/drug_case_api_schemas";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** GET /api/drug-intelligence/map */
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
