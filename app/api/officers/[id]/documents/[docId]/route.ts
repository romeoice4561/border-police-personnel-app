/**
 * GET    /api/officers/{id}/documents/{docId} — retrieve one document by id.
 * PATCH  /api/officers/{id}/documents/{docId} — update editable metadata
 *        (title/description only — Phase 46, e-PF Foundation).
 * DELETE /api/officers/{id}/documents/{docId} — soft-delete a document
 *        (isActive=false; bytes and row are never physically removed).
 *
 * Thin adapter: builds the document container and delegates to the
 * framework-agnostic handlers.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentContainer } from "@/lib/document/document_container";
import { handleGetDocument, handleUpdateDocumentMetadata, handleDeleteVersion } from "@/lib/document/document_api_handlers";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const container = await getDocumentContainer();
    return handleUpdateDocumentMetadata(
      container.service,
      decodeURIComponent(id),
      docId,
      request
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
    // handleDeleteVersion handles both active (soft-delete + promote) and
    // inactive (hard-delete) versions — covers DocumentRow delete and
    // History-panel per-version delete from a single endpoint.
    return handleDeleteVersion(
      container.service,
      decodeURIComponent(id),
      docId
    );
  });
}
