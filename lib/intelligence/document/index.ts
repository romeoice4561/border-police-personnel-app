/**
 * Document Engine — public Intelligence API (Phase 40A foundation).
 *
 * A thin facade over lib/document/document_status.ts's documentStatus() plus
 * OfficerDocument. Documents are an open, extensible set — any free-text
 * `documentType` (e.g. "GP7", "NATIONAL_ID"), no fixed "required checklist"
 * in the current schema (see lib/server/commander_query_service.ts's
 * hasActiveDocument/documentCodes, which use the same active-document-set
 * semantics this facade consolidates). This module does not invent a
 * required-documents concept that doesn't exist yet.
 *
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { documentStatus } from "@/lib/document/document_status";
import type { DocumentSummary } from "@/lib/intelligence/shared/types";

const GP7_TYPE_CODE = "GP7";

/** Computes an officer's document summary from their OfficerDocument rows. `available: false` (not a computed zero) when there are no documents at all. */
export function computeDocumentSummary(documents: readonly OfficerDocument[], hasOfficialPortrait: boolean): DocumentSummary {
  const active = documents.filter((doc) => doc.isActive !== false);

  if (active.length === 0) {
    return {
      available: false,
      activeCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      hasGp7: false,
      hasOfficialPortrait,
      activeDocumentTypes: [],
    };
  }

  let verifiedCount = 0;
  let pendingCount = 0;
  for (const doc of active) {
    const status = documentStatus(doc);
    if (status === "verified") verifiedCount += 1;
    else if (status === "pending") pendingCount += 1;
  }

  return {
    available: true,
    activeCount: active.length,
    verifiedCount,
    pendingCount,
    hasGp7: active.some((doc) => doc.documentType === GP7_TYPE_CODE),
    hasOfficialPortrait,
    activeDocumentTypes: active.map((doc) => doc.documentType),
  };
}
