/**
 * DI-11B — issue/clear the HttpOnly signed `bppis_actor` cookie.
 *
 * POST authenticates against the existing mock AuthBackend (same accounts as
 * client login). DELETE clears the bound cookie. Presence cookie `bppis_session`
 * remains client-managed. Existing Drug APIs are unchanged.
 */

import { z } from "zod";
import { guarded } from "@/lib/api/api_handlers";
import { badRequest, jsonError, jsonOk } from "@/lib/api/api_response";
import { getAuthBackend } from "@/lib/auth/mock_auth_backend";
import { boundSessionCookie, clearBoundSessionCookie } from "@/lib/auth/bound_session";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid session request");

    const result = await getAuthBackend().authenticate(parsed.data.username, parsed.data.password);
    if (!result.ok) {
      const status = result.error === "ACCOUNT_DISABLED" ? 403 : 401;
      return jsonError(result.error, "Authentication failed", status);
    }

    const response = jsonOk({
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        role: result.user.role,
      },
    });
    response.headers.append("Set-Cookie", boundSessionCookie(result.user.id, parsed.data.rememberMe === true));
    return response;
  });
}

export async function DELETE(): Promise<Response> {
  return guarded(async () => {
    const response = jsonOk({ cleared: true });
    response.headers.append("Set-Cookie", clearBoundSessionCookie());
    return response;
  });
}
