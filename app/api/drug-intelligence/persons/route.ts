/**
 * GET /api/drug-intelligence/persons — Person Directory list (Phase DI-2,
 * Section 7-9). Requires drug.read.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonDirectoryList } from "@/lib/drug_intelligence/drug_person_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { directoryService } = await getDrugIntelligenceContainer();
    return handleDrugPersonDirectoryList(directoryService, request.nextUrl.searchParams, request);
  });
}
