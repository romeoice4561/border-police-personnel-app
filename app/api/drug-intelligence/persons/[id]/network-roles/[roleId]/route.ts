/**
 * PATCH /api/drug-intelligence/persons/{id}/network-roles/{roleId}
 * DI-7.3: Update verification status of an existing role assertion. Requires drug.edit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleUpdateDrugPersonNetworkRoleStatus } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { roleId } = await params;
    const { db } = await getDrugIntelligenceContainer();
    return handleUpdateDrugPersonNetworkRoleStatus(db, decodeURIComponent(roleId), request);
  });
}
