/**
 * POST /api/officers/{id}/documents/{docId}/extract
 *
 * Runs Tier 1 (local OCR + deterministic rules) extraction only. Never
 * calls paid AI — see lib/extraction/extraction_api_handlers.ts's
 * handleExtractDocument for the full contract.
 *
 * Thin adapter: builds the document + extraction containers and delegates.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentReadContainer } from "@/lib/document/document_container";
import { getExtractionContainer } from "@/lib/extraction/extraction_container";
import { handleExtractDocument } from "@/lib/extraction/extraction_api_handlers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const documentContainer = await getDocumentReadContainer();
    const extractionContainer = getExtractionContainer();
    return handleExtractDocument(documentContainer.service, extractionContainer, decodeURIComponent(id), docId);
  });
}
