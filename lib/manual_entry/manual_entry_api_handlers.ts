/**
 * Manual Personnel Entry API handlers (Phase XX — Admin Only;
 * Phase XX.1 — server-side officers.create enforcement).
 *
 * The framework-agnostic core of POST /api/officers: takes a ManualEntryService
 * + a raw Request and returns a Web Response. The route handler under
 * app/api/officers/ is a thin adapter that builds the container and delegates
 * here — unit-testable with a fake service and no running server.
 *
 * Authorization (Phase XX.1): when AUTH_ENFORCED is true, require the presence
 * cookie and resolve the acting user via actorId against the AuthBackend, then
 * require `officers.create`. When soft-guarded (AUTH_ENFORCED false), actor
 * fields remain required for audit only (matches the rest of this codebase's
 * session model — full session lives in browser storage).
 */

import { z } from "zod";
import { badRequest, conflict, jsonError, jsonOk } from "@/lib/api/api_response";
import type { ManualEntryService } from "@/lib/manual_entry/manual_entry_service";
import { manualEntryCreateSchema } from "@/lib/manual_entry/manual_entry_api_schemas";
import { ManualEntryDuplicateError } from "@/lib/manual_entry/manual_entry_types";
import { AUTH_ENFORCED, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission } from "@/lib/auth/roles";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

const actorSchema = z.object({
  actorId: z.string().trim().min(1, "actorId is required"),
  actorName: z.string().trim().min(1, "actorName is required"),
});

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

/**
 * Enforces officers.create when AUTH_ENFORCED. Returns an error Response or
 * null when the request may proceed.
 */
export async function assertManualEntryCreatePermission(request: Request, actorId: string): Promise<Response | null> {
  if (!AUTH_ENFORCED) return null;

  const session = cookieValue(request, SESSION_COOKIE_NAME);
  if (!session) {
    return jsonError("UNAUTHENTICATED", "Authentication required", 401);
  }

  const user = await getAuthUserById(actorId);
  if (!user || !user.isActive) {
    return jsonError("UNAUTHENTICATED", "Invalid actor", 401);
  }
  if (!hasPermission(user.permissions, "officers.create")) {
    return jsonError("FORBIDDEN", "Missing permission: officers.create", 403);
  }
  return null;
}

/** POST /api/officers — Manual Personnel Entry create. */
export async function handleManualEntryCreate(service: ManualEntryService, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const fieldsParsed = manualEntryCreateSchema.safeParse(body);
  if (!fieldsParsed.success) return badRequest("Invalid manual entry request", zodDetails(fieldsParsed.error));

  const actorParsed = actorSchema.safeParse(body);
  if (!actorParsed.success) return badRequest("Invalid manual entry request", zodDetails(actorParsed.error));

  const denied = await assertManualEntryCreatePermission(request, actorParsed.data.actorId);
  if (denied) return denied;

  try {
    const result = await service.create({ ...fieldsParsed.data, ...actorParsed.data });
    return jsonOk(result, undefined, 201);
  } catch (error) {
    if (error instanceof ManualEntryDuplicateError) {
      return conflict("A matching officer already exists", { candidates: error.candidates });
    }
    throw error;
  }
}
