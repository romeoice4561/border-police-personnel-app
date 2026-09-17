/**
 * GET /api/drug-intelligence/network/compare — Link Compare bounded QUERY
 * analysis (LC-2A). Requires drug.read. Does not write intelligence.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugLinkCompare } from "@/lib/drug_intelligence/drug_link_compare_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { linkCompareService } = await getDrugIntelligenceContainer();
    return handleDrugLinkCompare(linkCompareService, request.nextUrl.searchParams, request);
  });
}
