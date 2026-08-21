/**
 * GET /api/drug-intelligence/devices/check — Section 10's real-time
 * "พบ IMEI นี้ในข้อมูลเดิม" reuse indicator. Existence-only, never creates or blocks.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugDeviceCheck } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { caseService } = await getDrugIntelligenceContainer();
    return handleDrugDeviceCheck(caseService, request.nextUrl.searchParams, request);
  });
}
