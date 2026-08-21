/**
 * GET /api/drug-intelligence/phones/check — Section 9's real-time
 * "พบหมายเลขนี้ในระบบแล้ว" reuse indicator. Existence-only, never creates or blocks.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPhoneCheck } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { caseService } = await getDrugIntelligenceContainer();
    return handleDrugPhoneCheck(caseService, request.nextUrl.searchParams, request);
  });
}
