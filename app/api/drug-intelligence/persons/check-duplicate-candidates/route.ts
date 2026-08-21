/**
 * POST /api/drug-intelligence/persons/check-duplicate-candidates — Section
 * 21/28's Create Case real-time duplicate check, backed by the Round A
 * matching engine. Requires drug.create.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonMatchCandidatesForDraft } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { matchingService } = await getDrugIntelligenceContainer();
    return handleDrugPersonMatchCandidatesForDraft(matchingService, request);
  });
}
