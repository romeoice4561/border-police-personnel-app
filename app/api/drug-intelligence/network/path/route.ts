/**
 * GET /api/drug-intelligence/network/path — Network Intelligence bounded
 * path finding (Phase DI-5, Section 5). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugGraphPath } from "@/lib/drug_intelligence/drug_network_graph_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { networkGraphService } = await getDrugIntelligenceContainer();
    return handleDrugGraphPath(networkGraphService, request.nextUrl.searchParams, request);
  });
}
