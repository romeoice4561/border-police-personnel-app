/**
 * GET /api/drug-intelligence/search — Global Intelligence Search grouped
 * overview (Phase DI-3, Section 3). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugSearchGrouped } from "@/lib/drug_intelligence/drug_search_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { searchService } = await getDrugIntelligenceContainer();
    return handleDrugSearchGrouped(searchService, request.nextUrl.searchParams, request);
  });
}
