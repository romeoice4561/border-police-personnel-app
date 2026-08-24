/**
 * POST /api/drug-intelligence/persons/{id}/network-memberships
 * DI-7.2: Add a network/group membership. Requires drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleAddDrugPersonNetworkMembership } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { db } = await getDrugIntelligenceContainer();
    return handleAddDrugPersonNetworkMembership(db, decodeURIComponent(id), request);
  });
}
