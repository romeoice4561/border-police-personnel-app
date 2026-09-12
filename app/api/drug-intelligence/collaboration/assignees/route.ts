/**
 * GET /api/drug-intelligence/collaboration/assignees — DI-11D.1 directory.
 * drug.read. Returns { id, displayName } only. No write. No audit.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { handleCollaborationAssignees } from "@/lib/drug_intelligence/drug_collaboration_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => handleCollaborationAssignees(request));
}
