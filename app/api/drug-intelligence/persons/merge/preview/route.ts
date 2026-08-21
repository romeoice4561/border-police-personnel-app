/**
 * GET /api/drug-intelligence/persons/merge/preview — Section 15's merge
 * preview (read-only, no writes). Requires drug.admin.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonMergePreview } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { mergeService } = await getDrugIntelligenceContainer();
    return handleDrugPersonMergePreview(mergeService, request.nextUrl.searchParams, request);
  });
}
