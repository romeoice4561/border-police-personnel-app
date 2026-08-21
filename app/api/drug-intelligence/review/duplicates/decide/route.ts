/**
 * POST /api/drug-intelligence/review/duplicates/decide — Section 19's
 * persistent review decision (CONFIRMED_DUPLICATE / NOT_SAME). Requires
 * drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugMatchReviewDecide } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { matchReviewService } = await getDrugIntelligenceContainer();
    return handleDrugMatchReviewDecide(matchReviewService, request);
  });
}
