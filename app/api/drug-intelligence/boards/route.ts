/**
 * GET  /api/drug-intelligence/boards — list actor-owned boards (drug.read)
 * POST /api/drug-intelligence/boards — create board (drug.edit)
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleInvestigationBoardCreate,
  handleInvestigationBoardList,
} from "@/lib/drug_intelligence/drug_investigation_board_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { investigationBoardService } = await getDrugIntelligenceContainer();
    return handleInvestigationBoardList(investigationBoardService, request.nextUrl.searchParams, request);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { investigationBoardService } = await getDrugIntelligenceContainer();
    return handleInvestigationBoardCreate(investigationBoardService, request);
  });
}
