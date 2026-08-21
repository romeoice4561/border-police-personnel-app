/**
 * GET/PATCH /api/drug-intelligence/persons/{id}/profile — Person
 * Intelligence Profile (Phase DI-2, Section 4-6, 21). GET requires
 * drug.read; PATCH requires drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonProfile, handleDrugPersonProfileUpdate } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { profileService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugPersonProfile(profileService, decodeURIComponent(id), actorId, request);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { profileService } = await getDrugIntelligenceContainer();
    return handleDrugPersonProfileUpdate(profileService, decodeURIComponent(id), request);
  });
}
