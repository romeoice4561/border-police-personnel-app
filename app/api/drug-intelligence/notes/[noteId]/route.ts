/**
 * GET/PATCH /api/drug-intelligence/notes/{noteId} — DI-11B one analyst note.
 * GET: drug.read. PATCH: drug.edit + bound session actor. No DELETE.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleNoteGet, handleNotePatch } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }): Promise<Response> {
  return guarded(async () => {
    const { noteId } = await params;
    const { analystNoteService } = await getDrugIntelligenceContainer();
    return handleNoteGet(analystNoteService, decodeURIComponent(noteId), request);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }): Promise<Response> {
  return guarded(async () => {
    const { noteId } = await params;
    const { analystNoteService } = await getDrugIntelligenceContainer();
    return handleNotePatch(analystNoteService, decodeURIComponent(noteId), request);
  });
}
