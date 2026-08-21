/**
 * POST /api/drug-intelligence/persons/{id}/identifiers — Section 23's "+
 * เพิ่มเลขประจำตัว". Requires drug.edit. Never bypasses the duplicate engine.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonAddIdentifier } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { profileService } = await getDrugIntelligenceContainer();
    return handleDrugPersonAddIdentifier(profileService, decodeURIComponent(id), request);
  });
}
