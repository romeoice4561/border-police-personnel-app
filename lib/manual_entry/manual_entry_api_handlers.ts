/**
 * Manual Personnel Entry API handlers (Phase XX — Admin Only).
 *
 * The framework-agnostic core of POST /api/officers: takes a ManualEntryService
 * + a raw Request and returns a Web Response. The route handler under
 * app/api/officers/ is a thin adapter that builds the container and delegates
 * here — unit-testable with a fake service and no running server.
 *
 * Authorization: the client-side AuthGate + officers.create permission is the
 * enforcement point (this codebase's established convention — see the
 * existing PATCH /api/officers/{id} and POST /api/officers/{id}/portrait
 * routes, neither of which re-checks permission server-side either, since
 * sessions today live in browser storage with only a presence cookie server-
 * side). The route still requires the caller to identify itself (actorId/
 * actorName in the body) purely for the createdBy audit stamp, not as a
 * security boundary.
 */

import { z } from "zod";
import { badRequest, conflict, jsonOk } from "@/lib/api/api_response";
import type { ManualEntryService } from "@/lib/manual_entry/manual_entry_service";
import { manualEntryCreateSchema } from "@/lib/manual_entry/manual_entry_api_schemas";
import { ManualEntryDuplicateError } from "@/lib/manual_entry/manual_entry_types";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

const actorSchema = z.object({
  actorId: z.string().trim().min(1, "actorId is required"),
  actorName: z.string().trim().min(1, "actorName is required"),
});

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
