/**
 * GET/POST /api/drug-intelligence/persons/{id}/tasks — DI-11B investigation tasks.
 * GET: drug.read. POST: drug.edit + bound session actor.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handlePersonTasksCreate, handlePersonTasksList } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { investigationTaskService } = await getDrugIntelligenceContainer();
    return handlePersonTasksList(investigationTaskService, decodeURIComponent(id), request.nextUrl.searchParams, request);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { investigationTaskService } = await getDrugIntelligenceContainer();
    return handlePersonTasksCreate(investigationTaskService, decodeURIComponent(id), request);
  });
}
