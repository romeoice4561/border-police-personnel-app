/**
 * GET /api/intelligence/officers/[officerId] — one safe officer intelligence detail.
 */
import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { handleIntelligenceOfficerDetail } from "@/lib/server/personnel_intelligence_api_handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ officerId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { officerId } = await params;
    return handleIntelligenceOfficerDetail(request, officerId);
  });
}
