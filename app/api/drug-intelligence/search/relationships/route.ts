/**
 * GET|POST /api/drug-intelligence/search/relationships — Relationship Search (Phase 1B + DI-8.3).
 * Requires drug.read. Read-only orchestration over Network graph + path.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleDrugRelationshipSearch,
  handleDrugRelationshipSearchPost,
} from "@/lib/drug_intelligence/drug_relationship_query_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { relationshipQueryService, entityMediaService } = await getDrugIntelligenceContainer();
    return handleDrugRelationshipSearch(relationshipQueryService, request.nextUrl.searchParams, request, entityMediaService);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { relationshipQueryService, entityMediaService } = await getDrugIntelligenceContainer();
    return handleDrugRelationshipSearchPost(relationshipQueryService, request, entityMediaService);
  });
}
