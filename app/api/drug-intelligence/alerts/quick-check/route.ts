/**
 * GET /api/drug-intelligence/alerts/quick-check — Section 4's debounced
 * real-time inline intelligence signal for the Create Case wizard (Phase
 * DI-6). Requires drug.create.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugAlertQuickCheck } from "@/lib/drug_intelligence/drug_intelligence_alert_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { alertService } = await getDrugIntelligenceContainer();
    return handleDrugAlertQuickCheck(alertService, request.nextUrl.searchParams, request);
  });
}
