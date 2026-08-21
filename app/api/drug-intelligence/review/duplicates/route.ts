/**
 * GET /api/drug-intelligence/review/duplicates — Duplicate Review Queue
 * (Phase DI-2, Section 13). Requires drug.read (viewing is fine for
 * commander; deciding/merging requires a higher permission — see the
 * decide/merge routes).
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugMatchReviewQueue } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { matchingService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugMatchReviewQueue(matchingService, actorId, request);
  });
}
