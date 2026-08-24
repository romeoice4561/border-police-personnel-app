/**
 * GET /api/drug-intelligence/timeline/geographic — จังหวัด/อำเภอ -> จำนวนคดี
 * aggregate (Phase DI-7, Section 9). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugTimelineGeographic } from "@/lib/drug_intelligence/drug_timeline_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { timelineService } = await getDrugIntelligenceContainer();
    return handleDrugTimelineGeographic(timelineService, request.nextUrl.searchParams, request);
  });
}
