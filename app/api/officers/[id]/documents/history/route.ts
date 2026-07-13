/**
 * GET /api/officers/{id}/documents/history?documentType=<type>
 *
 * Returns all versions (active + inactive) for a specific document type,
 * newest version first. Used by the History panel in the Document Vault UI.
 *
 * Static segment "history" takes precedence over the dynamic [docId] segment
 * so there is no routing conflict.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getDocumentContainer } from "@/lib/document/document_container";
import { handleDocumentHistory } from "@/lib/document/document_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const documentType = request.nextUrl.searchParams.get("documentType") ?? "";
    const result = await getDocumentContainer();
    if (!result.configured) return serviceUnavailable(result.reason);
    return handleDocumentHistory(
      result.container.service,
      result.container.repository,
      decodeURIComponent(id),
      documentType
    );
  });
}
