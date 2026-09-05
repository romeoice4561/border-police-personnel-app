/**
 * GET   /api/drug-intelligence/boards/{id} — load one owned board (drug.read)
 * PATCH /api/drug-intelligence/boards/{id} — save/rename with expectedVersion (drug.edit)
 * POST  /api/drug-intelligence/boards/{id} — duplicate or archive (`action`) on the
 *       registered [id] route. Nested /duplicate and /archive segments 404 in this
 *       Next runtime, so those verbs stay on the working board-id handler.
 */

import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/api/api_response";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleInvestigationBoardArchive,
  handleInvestigationBoardDuplicate,
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    if (!body || typeof body !== "object") return badRequest("Request body must be valid JSON");
    const { action, ...rest } = body as { action?: unknown };
    const inner = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(rest),
    });
    const { investigationBoardService } = await getDrugIntelligenceContainer();
    if (action === "duplicate") {
      return handleInvestigationBoardDuplicate(investigationBoardService, decodeURIComponent(id), inner);
    }
    if (action === "archive") {
      return handleInvestigationBoardArchive(investigationBoardService, decodeURIComponent(id), inner);
    }
    return badRequest("Unknown board action");
  });
}
