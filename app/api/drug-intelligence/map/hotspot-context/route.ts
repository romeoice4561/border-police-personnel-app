/**
 * POST /api/drug-intelligence/map/hotspot-context — DI-8.2B batch hotspot evidence.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { badRequest } from "@/lib/api/api_response";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugGeoHotspotContext } from "@/lib/drug_intelligence/drug_geo_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { hotspotContextService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    return handleDrugGeoHotspotContext(hotspotContextService, body, actorId, request);
  });
}
