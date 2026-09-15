/**
 * GET /api/drug-intelligence/persons/{id}/tasks/{taskId}/notes
 * Target-scoped related result Notes. drug.read. Bounded.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handlePersonTaskRelatedNotesList } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, taskId } = await params;
    const { analystNoteService } = await getDrugIntelligenceContainer();
    return handlePersonTaskRelatedNotesList(
      analystNoteService,
      decodeURIComponent(id),
      decodeURIComponent(taskId),
      request.nextUrl.searchParams,
      request
    );
  });
}
