/**
 * GET /api/officers/{id}/documents/{docId}/download
 *
 * Proxies the stored document file back to the client with
 * Content-Disposition: attachment so the browser downloads it.
 * Works for images (jpg/png/webp) and PDFs.
 *
 * Storage configuration is NOT required at the container level. The stored
 * fileUrl is read from PostgreSQL and fetched directly — no storage.put()
 * is ever called by this route.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentContainer } from "@/lib/document/document_container";
import { handleDownloadDocument } from "@/lib/document/document_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const container = await getDocumentContainer();
    return handleDownloadDocument(
      container.service,
      decodeURIComponent(id),
      docId
    );
  });
}
