/**
 * GET /api/drug-intelligence/persons/{id}/related-task-notes?ids=
 * Batch related result Notes for Task cards on one Person page. drug.read. Bounded.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handlePersonRelatedTaskNotesBatch } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { analystNoteService } = await getDrugIntelligenceContainer();
    return handlePersonRelatedTaskNotesBatch(
      analystNoteService,
      decodeURIComponent(id),
      request.nextUrl.searchParams,
      request
    );
  });
}
