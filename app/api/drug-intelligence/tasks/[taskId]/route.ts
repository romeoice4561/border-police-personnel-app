/**
 * GET/PATCH /api/drug-intelligence/tasks/{taskId} — DI-11B one investigation task.
 * GET: drug.read. PATCH: drug.edit + bound session actor. No DELETE.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleTaskGet, handleTaskPatch } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }): Promise<Response> {
  return guarded(async () => {
    const { taskId } = await params;
    const { investigationTaskService } = await getDrugIntelligenceContainer();
    return handleTaskGet(investigationTaskService, decodeURIComponent(taskId), request);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }): Promise<Response> {
  return guarded(async () => {
    const { taskId } = await params;
    const { investigationTaskService } = await getDrugIntelligenceContainer();
    return handleTaskPatch(investigationTaskService, decodeURIComponent(taskId), request);
  });
}
