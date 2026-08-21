/**
 * GET  /api/drug-intelligence/cases — Drug Intelligence case list (Phase
 *      DI-1, Section 16). Requires drug.read.
 * POST /api/drug-intelligence/cases — create a new case (Section 4/17).
 *      Requires drug.create.
 *
 * Thin route-handler adapter: builds the module container and delegates to
 * the framework-agnostic handlers. Completely independent of the Officer/
 * Personnel API routes and the AI/Drive import pipeline.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugCaseCreate, handleDrugCaseList } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { caseService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugCaseList(caseService, request.nextUrl.searchParams, actorId, request);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { caseService } = await getDrugIntelligenceContainer();
    return handleDrugCaseCreate(caseService, request);
  });
}
