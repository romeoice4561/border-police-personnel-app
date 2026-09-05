/**
 * POST /api/drug-intelligence/boards/{id}/archive — soft-archive owned board (drug.edit)
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleInvestigationBoardArchive } from "@/lib/drug_intelligence/drug_investigation_board_api_handlers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { investigationBoardService } = await getDrugIntelligenceContainer();
    return handleInvestigationBoardArchive(investigationBoardService, decodeURIComponent(id), request);
  });
}
