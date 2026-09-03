/**
 * GET /api/drug-intelligence/command/signals
 * Commander Dashboard intelligence signals (Phase 2B). Requires drug.read.
 * Global — not date-bounded by arrestDate.
 */
import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleCommanderSignals } from "@/lib/drug_intelligence/drug_commander_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { commanderDashboardService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleCommanderSignals(commanderDashboardService, request.nextUrl.searchParams, actorId, request);
  });
}
