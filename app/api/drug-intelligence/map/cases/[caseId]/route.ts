/**
 * GET /api/drug-intelligence/map/cases/{caseId} — Map popup detail (DI-10E.6C).
 * Requires drug.read. One case only. Not the Case Workspace endpoint.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugMapCaseDetail } from "@/lib/drug_intelligence/drug_geo_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { caseId } = await params;
    const { mapCaseDetailService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugMapCaseDetail(mapCaseDetailService, decodeURIComponent(caseId), actorId, request);
  });
}
