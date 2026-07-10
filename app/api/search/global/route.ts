/**
 * GET /api/search/global — Phase 26B Part B: single free-text query box,
 * merged across Officer fields and every registered SearchProvider (Drive
 * filename today; future document titles/GP7 numbers). See
 * lib/search/global_search_service.ts.
 */

import type { NextRequest } from "next/server";
import { getApiContainer } from "@/lib/api/api_container";
import { handleGlobalSearch, guarded } from "@/lib/api/api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  // Factory (not awaited container) so validation runs before any DB client is created.
  return guarded(() => handleGlobalSearch(getApiContainer, request.nextUrl.searchParams));
}
