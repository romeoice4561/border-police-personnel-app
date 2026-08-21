/**
 * POST /api/drug-intelligence/persons/merge — Section 15's merge execution.
 * Requires drug.admin.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonMerge } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { mergeService } = await getDrugIntelligenceContainer();
    return handleDrugPersonMerge(mergeService, request);
  });
}
