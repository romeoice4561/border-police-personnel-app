/**
 * POST /api/drug-intelligence/persons/{id}/aliases — Section 22's "+
 * เพิ่มชื่ออื่น". Requires drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonAddAlias } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { profileService } = await getDrugIntelligenceContainer();
    return handleDrugPersonAddAlias(profileService, decodeURIComponent(id), request);
  });
}
