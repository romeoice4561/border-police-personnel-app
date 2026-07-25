/**
 * Authentication for Personnel Search API — reuses Phase 49.5 intelligence auth.
 */
import "server-only";

import type { NextRequest } from "next/server";
import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
import { resolveIntelligenceActor } from "@/lib/server/personnel_intelligence_api_auth";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";

export type PersonnelSearchActor = IntelligenceActor;

/**
 * Resolves the authenticated actor. Rejects anonymous callers.
 * Never trusts x-role / x-user-id / x-unit / x-permission-scope headers.
 */
export async function resolvePersonnelSearchActor(request: NextRequest): Promise<PersonnelSearchActor> {
  // Explicitly ignore spoofable identity headers (defense in depth).
  void request.headers.get("x-role");
  void request.headers.get("x-user-id");
  void request.headers.get("x-unit");
  void request.headers.get("x-permission-scope");

  const resolved = await resolveIntelligenceActor(request);
  if (!resolved.ok) {
    throw new PersonnelSearchApiError("UNAUTHENTICATED", "Authentication required", 401);
  }
  return resolved.actor;
}
