/**
 * DI-11B collaboration authorization.
 *
 * Derives the trusted actor from the HttpOnly signed `bppis_actor` cookie.
 * Client actorId/actorName on the request are ignored for authorship.
 *
 * Read: drug.read (global among those holders for MVP).
 * Write: drug.edit.
 * Assignees must be active login users who themselves have drug.read.
 */

import { badRequest, conflict, jsonError } from "@/lib/api/api_response";
import { AUTH_ENFORCED, BOUND_SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { readCookieValue, verifyBoundSessionToken } from "@/lib/auth/bound_session";
import { getAuthBackend, getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import type { CollaborationActor } from "@/lib/drug_intelligence/drug_collaboration_types";

export async function resolveBoundCollaborationUser(request: Request): Promise<AuthUser | null> {
  const token = readCookieValue(request, BOUND_SESSION_COOKIE_NAME);
  if (!token) return null;
  const payload = verifyBoundSessionToken(token);
  if (!payload) return null;
  const user = await getAuthUserById(payload.actorId);
  if (!user || !user.isActive) return null;
  return user;
}

export async function assertCollaborationPermission(
  request: Request,
  permission: "drug.read" | "drug.edit"
): Promise<{ ok: true; actor: CollaborationActor; user: AuthUser } | { ok: false; response: Response }> {
  const user = await resolveBoundCollaborationUser(request);
  if (!user) return { ok: false, response: jsonError("UNAUTHENTICATED", "Bound collaboration session required", 401) };
  if (AUTH_ENFORCED && !hasPermission(user.permissions, permission)) {
    return { ok: false, response: jsonError("FORBIDDEN", `Missing permission: ${permission}`, 403) };
  }
  return { ok: true, actor: { actorId: user.id, actorName: user.displayName }, user };
}

/**
 * Collaboration writes require the UI/client to confirm the displayed actor.
 * Authorship still comes only from the bound cookie. A mismatch (cross-tab
 * account switch, stale cookie) is rejected instead of silently attributing
 * the write to a different server actor.
 */
export function assertConfirmActorId(
  body: unknown,
  actorId: string
): { ok: true } | { ok: false; response: Response } {
  const confirm =
    body && typeof body === "object" && !Array.isArray(body) && "confirmActorId" in body
      ? String((body as { confirmActorId?: unknown }).confirmActorId ?? "").trim()
      : "";
  if (!confirm) return { ok: false, response: badRequest("confirmActorId is required") };
  if (confirm !== actorId) {
    return { ok: false, response: conflict("Bound actor does not match confirmActorId") };
  }
  return { ok: true };
}

export async function listAssignableCollaborationActors(): Promise<AuthUser[]> {
  const backend = getAuthBackend();
  const users = typeof backend.listUsers === "function" ? await backend.listUsers() : [];
  return users.filter((next) => next.isActive && hasPermission(next.permissions, "drug.read"));
}

export async function resolveAssignableActor(assignedActorId: string | null | undefined): Promise<CollaborationActor | null> {
  if (assignedActorId == null || assignedActorId.trim() === "") return null;
  const assignable = await listAssignableCollaborationActors();
  const match = assignable.find((user) => user.id === assignedActorId);
  if (!match) return null;
  return { actorId: match.id, actorName: match.displayName };
}
