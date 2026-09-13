/**
 * GET /api/drug-intelligence/persons/{id}/related-note-tasks?ids=
 * Batch related Tasks for Note cards on one Person page. drug.read. Bounded.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handlePersonRelatedNoteTasksBatch } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { investigationTaskService } = await getDrugIntelligenceContainer();
    return handlePersonRelatedNoteTasksBatch(
      investigationTaskService,
      decodeURIComponent(id),
      request.nextUrl.searchParams,
      request
    );
  });
}
