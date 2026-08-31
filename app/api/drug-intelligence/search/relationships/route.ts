/**
 * GET /api/drug-intelligence/search/relationships — Relationship Search MVP (Phase 1B).
 * Requires drug.read. Read-only orchestration over Network graph + path.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugRelationshipSearch } from "@/lib/drug_intelligence/drug_relationship_query_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { relationshipQueryService } = await getDrugIntelligenceContainer();
    return handleDrugRelationshipSearch(relationshipQueryService, request.nextUrl.searchParams, request);
  });
}
