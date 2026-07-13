/**
 * GET  /api/officers/{id}/documents — list all active documents for an officer.
 * POST /api/officers/{id}/documents — upload a new document (multipart/form-data,
 *      fields: file, documentType, title, description?, uploadedBy?).
 *
 * Thin adapter: builds the document container and delegates to the
 * framework-agnostic handlers. `params` is a Promise in this Next.js version.
 * Google Drive is never written — bytes go to Supabase Storage.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentContainer } from "@/lib/document/document_container";
import { handleListDocuments, handleUploadDocument } from "@/lib/document/document_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const container = await getDocumentContainer();
    return handleListDocuments(
      container.service,
      container.repository,
      decodeURIComponent(id)
    );
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const container = await getDocumentContainer();
    return handleUploadDocument(
      container.service,
      container.repository,
      decodeURIComponent(id),
      request
    );
  });
}
