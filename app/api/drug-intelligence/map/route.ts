/**
 * GET /api/drug-intelligence/map — Geographic / Map Intelligence read model
 * (Phase DI-8, Section 32/33). Requires drug.read.
 *
 * Thin route-handler adapter: builds the module container and delegates to
 * the framework-agnostic handler.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugGeoResult } from "@/lib/drug_intelligence/drug_geo_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { geoIntelligenceService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugGeoResult(geoIntelligenceService, request.nextUrl.searchParams, actorId, request);
  });
}
