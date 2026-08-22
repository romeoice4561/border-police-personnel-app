/**
 * POST /api/drug-intelligence/alerts/{id}/review — Section 9 alert
 * lifecycle (Phase DI-6). Requires drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugAlertReview } from "@/lib/drug_intelligence/drug_intelligence_alert_api_handlers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { alertService } = await getDrugIntelligenceContainer();
    return handleDrugAlertReview(alertService, decodeURIComponent(id), request);
  });
}
