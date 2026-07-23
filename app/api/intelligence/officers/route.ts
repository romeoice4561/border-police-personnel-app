/**
 * GET /api/intelligence/officers — paginated safe officer search (Phase 49.5).
 * Authenticated + capability-checked. Read-only.
 */
import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { handleIntelligenceOfficers } from "@/lib/server/personnel_intelligence_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(() => handleIntelligenceOfficers(request));
}
