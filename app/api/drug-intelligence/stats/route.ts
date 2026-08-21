/**
 * GET /api/drug-intelligence/stats — Drug Intelligence landing-page KPI
 * aggregate (Phase DI-1 Round 2, Section 4). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugStats } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { statsService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugStats(statsService, actorId, request);
  });
}
