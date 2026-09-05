/**
 * POST /api/drug-intelligence/board-images — upload (multipart)
 * GET  /api/drug-intelligence/board-images — batch signed access
 *
 * Flat routes at the same depth as /boards/{id}. Nested /boards/{id}/images
 * is avoided after the DI-9.5C Turbopack HTML-404 incident.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import {
  handleBoardImageAccess,
  handleBoardImageDelete,
  handleBoardImageUpload,
} from "@/lib/drug_intelligence/drug_investigation_board_image_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { investigationBoardImageService } = await getDrugIntelligenceContainer();
    if (!investigationBoardImageService) return serviceUnavailable("Private image storage is not available");
    return handleBoardImageUpload(investigationBoardImageService, request);
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { investigationBoardImageService } = await getDrugIntelligenceContainer();
    if (!investigationBoardImageService) return serviceUnavailable("Private image storage is not available");
    return handleBoardImageAccess(investigationBoardImageService, request);
  });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { investigationBoardImageService } = await getDrugIntelligenceContainer();
    if (!investigationBoardImageService) return serviceUnavailable("Private image storage is not available");
    return handleBoardImageDelete(investigationBoardImageService, request);
  });
}
