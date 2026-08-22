/**
 * GET /api/drug-intelligence/alerts/case — alert summary for one case
 * (Phase DI-6, Section 13). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugAlertsForCase } from "@/lib/drug_intelligence/drug_intelligence_alert_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { alertService } = await getDrugIntelligenceContainer();
    return handleDrugAlertsForCase(alertService, request.nextUrl.searchParams, request);
  });
}
