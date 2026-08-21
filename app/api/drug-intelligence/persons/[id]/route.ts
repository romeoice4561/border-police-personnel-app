/**
 * GET /api/drug-intelligence/persons/{id} — Person Detail Drawer data
 * (Phase DI-1 Round 2, Section 18). Requires drug.read. `params` is a
 * Promise in this Next.js version and must be awaited.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugPersonDetail } from "@/lib/drug_intelligence/drug_case_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { caseService } = await getDrugIntelligenceContainer();
    const actorId = request.nextUrl.searchParams.get("actorId");
    return handleDrugPersonDetail(caseService, decodeURIComponent(id), actorId, request);
  });
}
