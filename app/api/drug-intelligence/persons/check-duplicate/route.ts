/**
 * POST /api/drug-intelligence/persons/check-duplicate — Section 8/14's
 * real-time duplicate-safety check, callable before the Create Case form is
 * submitted. Never creates or blocks anything by itself — only reports
 * candidates for the caller to review.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonDuplicateCheck } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { caseService } = await getDrugIntelligenceContainer();
    return handleDrugPersonDuplicateCheck(caseService, request);
  });
}
