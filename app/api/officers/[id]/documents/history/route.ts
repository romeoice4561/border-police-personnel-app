/**
 * GET /api/officers/{id}/documents/history?documentType=<type>
 *
 * Returns all versions (active + inactive) for a specific document type,
 * newest version first. Used by the History panel in the Document Vault UI.
 *
 * Uses getDocumentReadContainer() — a DB-only container with no storage
 * dependency. History reads exclusively from PostgreSQL; it must work even
 * when Supabase Storage is unconfigured or the upload bucket is missing.
 *
 * Static segment "history" takes precedence over the dynamic [docId] segment
 * in Next.js routing so there is no conflict.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDocumentReadContainer } from "@/lib/document/document_container";
import { handleDocumentHistory } from "@/lib/document/document_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const documentType = request.nextUrl.searchParams.get("documentType") ?? "";
    const container = await getDocumentReadContainer();
    return handleDocumentHistory(
      container.service,
      container.repository,
      decodeURIComponent(id),
      documentType
    );
  });
}
