/**
 * GET /api/search — multi-field officer search (name, rank, unit, phone,
 * position, careerYears, quality, region) with contains/startsWith/exact,
 * case-insensitive, paginated and sorted.
 */

import type { NextRequest } from "next/server";
import { getApiContainer } from "@/lib/api/api_container";
import { handleOfficerSearch, guarded } from "@/lib/api/api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  // Factory (not awaited container) so search validation runs before any DB
  // client is created.
  return guarded(() => handleOfficerSearch(getApiContainer, request.nextUrl.searchParams));
}
