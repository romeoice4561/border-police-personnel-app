/**
 * GET /api/officers — paginated, filtered, sorted officer list.
 *
 * Thin route-handler adapter: builds the API container (real Prisma client)
 * and delegates to the framework-agnostic handler. No SQL, no business logic
 * here. Route Handlers are not cached by default (Next 16); this reads
 * request-time query params so it always runs dynamically.
 */

import type { NextRequest } from "next/server";
import { getApiContainer } from "@/lib/api/api_container";
import { handleOfficerList, guarded } from "@/lib/api/api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  // Pass the container factory (not an awaited container) so query validation
  // runs before any DB client is created — invalid requests 400 without a DB.
  return guarded(() => handleOfficerList(getApiContainer, request.nextUrl.searchParams));
}
