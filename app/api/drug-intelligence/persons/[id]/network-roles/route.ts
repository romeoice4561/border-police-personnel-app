/**
 * POST /api/drug-intelligence/persons/{id}/network-roles
 * DI-7.3: Append a network-role assertion. Requires drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleAddDrugPersonNetworkRole } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { db } = await getDrugIntelligenceContainer();
    return handleAddDrugPersonNetworkRole(db, decodeURIComponent(id), request);
  });
}
