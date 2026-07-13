/**
 * GET /api/officers/{id}/documents/{docId}/download
 *
 * Proxies the stored document file back to the client with
 * Content-Disposition: attachment so the browser downloads it.
 * Works for images (jpg/png/webp) and PDFs.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getDocumentContainer } from "@/lib/document/document_container";
import { handleDownloadDocument } from "@/lib/document/document_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, docId } = await params;
    const result = await getDocumentContainer();
    if (!result.configured) return serviceUnavailable(result.reason);
    return handleDownloadDocument(
      result.container.service,
      decodeURIComponent(id),
      docId
    );
  });
}
