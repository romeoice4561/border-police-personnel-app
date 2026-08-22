/**
 * POST /api/drug-intelligence/alerts/generate — Section 6/7's post-create
 * intelligence generation trigger (Phase DI-6). Called AFTER a case has
 * already been saved successfully — never part of case creation's own
 * transaction, never able to block or roll back a save. Requires
 * drug.create (same gate as case creation itself).
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugAlertGenerate } from "@/lib/drug_intelligence/drug_intelligence_alert_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { alertService } = await getDrugIntelligenceContainer();
    return handleDrugAlertGenerate(alertService, request);
  });
}
