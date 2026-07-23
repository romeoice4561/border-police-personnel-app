/**
 * API authentication for Personnel Intelligence routes (Phase 49.5).
 *
 * Existing page auth stores the full session in browser storage and only a
 * presence cookie on the server. Until real server sessions exist, these
 * routes authenticate via HTTP Basic against the existing AuthBackend
 * (mock admin/commander/officer accounts) AND require the bppis_session
 * cookie when AUTH_ENFORCED is true.
 */
import "server-only";

import type { NextRequest } from "next/server";
import { AUTH_ENFORCED, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { getAuthBackend } from "@/lib/auth/mock_auth_backend";
import { jsonError } from "@/lib/api/api_response";
import {
  actorFromAuthUser,
  type IntelligenceActor,
} from "@/lib/personnel_intelligence_service/permissions";

export type ResolveActorResult =
  | { ok: true; actor: IntelligenceActor }
  | { ok: false; response: Response };

function unauthorized(message: string): Response {
  return jsonError("UNAUTHENTICATED", message, 401);
}

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon <= 0) return null;
    return { username: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

/**
 * Resolves the intelligence actor for an API request.
 * Requires session cookie (when AUTH_ENFORCED) + Basic credentials.
 */
export async function resolveIntelligenceActor(request: NextRequest): Promise<ResolveActorResult> {
  if (AUTH_ENFORCED) {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!cookie) {
      return { ok: false, response: unauthorized("Authentication required") };
    }
  }

  const basic = parseBasicAuth(request.headers.get("authorization"));
  if (!basic) {
    return {
      ok: false,
      response: unauthorized("Basic authentication required for intelligence API"),
    };
  }

  const result = await getAuthBackend().authenticate(basic.username, basic.password);
  if (!result.ok || !result.user.isActive) {
    return { ok: false, response: unauthorized("Invalid credentials") };
  }

  return { ok: true, actor: actorFromAuthUser(result.user) };
}
