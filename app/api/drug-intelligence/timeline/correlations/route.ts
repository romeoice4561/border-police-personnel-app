/**
 * GET /api/drug-intelligence/timeline/correlations — deterministic
 * time+location correlation signals (Phase DI-7, Section 10). Requires
 * drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugTimelineCorrelations } from "@/lib/drug_intelligence/drug_timeline_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { timelineService } = await getDrugIntelligenceContainer();
    return handleDrugTimelineCorrelations(timelineService, request.nextUrl.searchParams, request);
  });
}
