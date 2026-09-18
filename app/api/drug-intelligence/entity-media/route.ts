/**
 * GET/POST /api/drug-intelligence/entity-media
 * List (drug.read) and upload (drug.edit) entity photos.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleEntityMediaList,
  handleEntityMediaUpload,
} from "@/lib/drug_intelligence/drug_entity_media_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { entityMediaService } = await getDrugIntelligenceContainer();
    if (!entityMediaService) return serviceUnavailable("Private image storage is not available");
    return handleEntityMediaList(entityMediaService, request.nextUrl.searchParams, request);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { entityMediaService } = await getDrugIntelligenceContainer();
    if (!entityMediaService) return serviceUnavailable("Private image storage is not available");
    return handleEntityMediaUpload(entityMediaService, request);
  });
}
