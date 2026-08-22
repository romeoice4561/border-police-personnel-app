/**
 * GET /api/drug-intelligence/sims/{id} — SIM entity detail (Phase DI-3,
 * Section 14). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugSimDetail } from "@/lib/drug_intelligence/drug_entity_detail_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { entityDetailService } = await getDrugIntelligenceContainer();
    return handleDrugSimDetail(entityDetailService, decodeURIComponent(id), request.nextUrl.searchParams, request);
  });
}
