/**
 * GET /api/drug-intelligence/persons/{id}/notes/{noteId}/tasks
 * Target-scoped related Tasks. drug.read. Bounded.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handlePersonNoteRelatedTasksList } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, noteId } = await params;
    const { investigationTaskService } = await getDrugIntelligenceContainer();
    return handlePersonNoteRelatedTasksList(
      investigationTaskService,
      decodeURIComponent(id),
      decodeURIComponent(noteId),
      request.nextUrl.searchParams,
      request
    );
  });
}
