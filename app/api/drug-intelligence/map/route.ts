/**
 * GET /api/drug-intelligence/map — bounded Map V2 (DI-10E.6B).
 * Requires drug.read. Uses DrugMapQueryService — not the legacy fetch-all loader.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugMapQuery } from "@/lib/drug_intelligence/drug_geo_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { mapQueryService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugMapQuery(mapQueryService, request.nextUrl.searchParams, actorId, request);
  });
}
