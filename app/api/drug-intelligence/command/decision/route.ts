/**
 * GET /api/drug-intelligence/command/decision
 * Commander previous-period comparison + data readiness (Phase 2D). Requires drug.read.
 */
import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleCommanderDecision } from "@/lib/drug_intelligence/drug_commander_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { commanderDashboardService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleCommanderDecision(commanderDashboardService, request.nextUrl.searchParams, actorId, request);
  });
}
