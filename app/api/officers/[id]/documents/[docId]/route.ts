/**
 * GET    /api/officers/{id}/documents/{docId} — retrieve one document by id.
 * DELETE /api/officers/{id}/documents/{docId} — soft-delete a document
 *        (isActive=false; bytes and row are never physically removed).
 *
 * Thin adapter: builds the document container and delegates to the
 * framework-agnostic handlers.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentContainer } from "@/lib/document/document_container";
import { handleGetDocument, handleDeleteDocument } from "@/lib/document/document_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const container = await getDocumentContainer();
    return handleGetDocument(
      container.service,
      decodeURIComponent(id),
      docId
    );
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const container = await getDocumentContainer();
    return handleDeleteDocument(
      container.service,
      decodeURIComponent(id),
      docId
    );
  });
}
