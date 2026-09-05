/**
 * GET   /api/drug-intelligence/boards/{id} — load one owned board (drug.read)
 * PATCH /api/drug-intelligence/boards/{id} — save/rename with expectedVersion (drug.edit)
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleInvestigationBoardGet,
  handleInvestigationBoardUpdate,
} from "@/lib/drug_intelligence/drug_investigation_board_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { investigationBoardService } = await getDrugIntelligenceContainer();
    return handleInvestigationBoardGet(investigationBoardService, decodeURIComponent(id), request.nextUrl.searchParams, request);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { investigationBoardService } = await getDrugIntelligenceContainer();
    return handleInvestigationBoardUpdate(investigationBoardService, decodeURIComponent(id), request);
  });
}
