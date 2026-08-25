/**
 * GET /api/drug-intelligence/persons/search — Advanced person search (DI-7.4).
 * Requires drug.read permission.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonAdvancedSearch } from "@/lib/drug_intelligence/drug_person_advanced_search_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { db } = await getDrugIntelligenceContainer();
    return handleDrugPersonAdvancedSearch(db, request.nextUrl.searchParams, request);
  });
}
