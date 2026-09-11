/**
 * GET/POST /api/drug-intelligence/persons/{id}/notes — DI-11B analyst notes.
 * GET: drug.read. POST: drug.edit + bound session actor.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handlePersonNotesCreate, handlePersonNotesList } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { analystNoteService } = await getDrugIntelligenceContainer();
    return handlePersonNotesList(analystNoteService, decodeURIComponent(id), request.nextUrl.searchParams, request);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { analystNoteService } = await getDrugIntelligenceContainer();
    return handlePersonNotesCreate(analystNoteService, decodeURIComponent(id), request);
  });
}
