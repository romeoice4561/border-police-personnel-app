/**
 * PATCH/DELETE /api/drug-intelligence/entity-media/{id}
 * Metadata / set-primary / delete. drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleEntityMediaDelete,
  handleEntityMediaPatch,
} from "@/lib/drug_intelligence/drug_entity_media_api_handlers";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { entityMediaService } = await getDrugIntelligenceContainer();
    if (!entityMediaService) return serviceUnavailable("Private image storage is not available");
    const { id } = await context.params;
    return handleEntityMediaPatch(entityMediaService, id, request);
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { entityMediaService } = await getDrugIntelligenceContainer();
    if (!entityMediaService) return serviceUnavailable("Private image storage is not available");
    const { id } = await context.params;
    return handleEntityMediaDelete(entityMediaService, id, request);
  });
}
