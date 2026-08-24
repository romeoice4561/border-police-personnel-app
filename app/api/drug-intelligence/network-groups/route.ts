/**
 * GET  /api/drug-intelligence/network-groups?query=...&actorId=... — search groups (drug.read)
 * POST /api/drug-intelligence/network-groups — create canonical group (drug.edit)
 * DI-7.2.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugNetworkGroupSearch, handleDrugNetworkGroupCreate } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { db } = await getDrugIntelligenceContainer();
    return handleDrugNetworkGroupSearch(db, request.nextUrl.searchParams, request);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { db } = await getDrugIntelligenceContainer();
    return handleDrugNetworkGroupCreate(db, request);
  });
}
