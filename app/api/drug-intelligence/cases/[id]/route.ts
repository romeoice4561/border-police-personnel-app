/**
 * GET /api/drug-intelligence/cases/{id} — case detail (Phase DI-1, Section
 * 18's Case Workspace). Requires drug.read. `params` is a Promise in this
 * Next.js version and must be awaited.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugCaseDetail } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { caseService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugCaseDetail(caseService, decodeURIComponent(id), actorId, request);
  });
}
