/**
 * GET /api/drug-intelligence/search/by-type — single-entity-type paginated
 * search, backing each result group's "ดูทั้งหมด" drill-in (Phase DI-3,
 * Section 24). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugSearchByType } from "@/lib/drug_intelligence/drug_search_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { searchService } = await getDrugIntelligenceContainer();
    return handleDrugSearchByType(searchService, request.nextUrl.searchParams, request);
  });
}
