/**
 * GET /api/drug-intelligence/persons/{id}/potential-duplicates — the
 * Person Profile's Review/Data Quality tab (Phase DI-2, Section 6).
 * Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonPotentialDuplicates } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { profileService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugPersonPotentialDuplicates(profileService, decodeURIComponent(id), actorId, request);
  });
}
