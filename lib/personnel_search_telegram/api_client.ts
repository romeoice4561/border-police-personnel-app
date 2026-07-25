/**
 * Calls Personnel Search API as a resolved Telegram principal (Phase 51.3).
 * No shared Basic Auth for human searches.
 */

import { NextRequest } from "next/server";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import { handlePersonnelSearchRequest } from "@/lib/personnel_search_api/handler";
import type {
  BoundTelegramApiClient,
  TelegramSearchApiCall,
} from "@/lib/personnel_search_telegram/types";

/**
 * Invoke the Personnel Search API handler with an injected actor
 * (from Telegram identity binding). Role/scope come from AuthUser only.
 */
export function createBoundPersonnelSearchApiClient(): BoundTelegramApiClient {
  return async (call, actor) => {
    const body: Record<string, unknown> = {
      query: call.query,
      client: "telegram",
      disclosureLevel: call.disclosureLevel ?? 2,
      limit: call.limit ?? 8,
    };
    if (call.cursor) body.cursor = call.cursor;
    if (call.unitScope) body.unitScope = call.unitScope;
    if (call.intentHint) body.intentHint = call.intentHint;

    const request = new NextRequest("http://localhost/api/personnel-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await handlePersonnelSearchRequest(request, {
      resolveActor: async () => actor,
    });
    return (await response.json()) as PersonnelSearchApiResponse;
  };
}
