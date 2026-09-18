/**
 * GET /api/drug-intelligence/entity-media/primaries
 * Batch thumbnail lookup for search / relationship / graph. drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleEntityMediaPrimaries } from "@/lib/drug_intelligence/drug_entity_media_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { entityMediaService } = await getDrugIntelligenceContainer();
    if (!entityMediaService) return serviceUnavailable("Private image storage is not available");
    return handleEntityMediaPrimaries(entityMediaService, request.nextUrl.searchParams, request);
  });
}
