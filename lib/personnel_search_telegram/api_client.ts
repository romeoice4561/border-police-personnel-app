/**
 * Calls the Secure Personnel Search API boundary (Phase 51.2).
 * Uses handlePersonnelSearchRequest — same path as POST /api/personnel-search.
 * No Gateway / repository imports.
 */

import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import { handlePersonnelSearchRequest } from "@/lib/personnel_search_api/handler";
import type { TelegramApiClient, TelegramSearchApiCall } from "@/lib/personnel_search_telegram/types";

function basicHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

/**
 * Default client: invoke the Personnel Search API handler with service credentials.
 */
export const createPersonnelSearchApiClient = (): TelegramApiClient => {
  return async (call, auth) => {
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
      headers: {
        "content-type": "application/json",
        authorization: basicHeader(auth.username, auth.password),
        cookie: `${SESSION_COOKIE_NAME}=1`,
      },
      body: JSON.stringify(body),
    });

    const response = await handlePersonnelSearchRequest(request);
    return (await response.json()) as PersonnelSearchApiResponse;
  };
};
