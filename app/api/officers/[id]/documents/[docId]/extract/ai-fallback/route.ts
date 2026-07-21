/**
 * POST /api/officers/{id}/documents/{docId}/extract/ai-fallback
 *
 * Runs the ACTUAL paid AI extraction call (Tier 3). Requires an explicit
 * `{ userConfirmed: true }` body — see
 * lib/extraction/extraction_api_handlers.ts's handleAiFallback for the
 * full gate/budget re-verification this performs server-side (never
 * trusted from the client).
 *
 * Thin adapter: builds the document + extraction containers and delegates.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentReadContainer } from "@/lib/document/document_container";
import { getExtractionContainer } from "@/lib/extraction/extraction_container";
import { handleAiFallback } from "@/lib/extraction/extraction_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const documentContainer = await getDocumentReadContainer();
    const extractionContainer = getExtractionContainer();
    return handleAiFallback(documentContainer.service, extractionContainer, decodeURIComponent(id), docId, request);
  });
}
