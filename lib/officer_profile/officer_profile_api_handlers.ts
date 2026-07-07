/**
 * Officer Profile Workspace API handlers (Phase 23A).
 *
 * The framework-agnostic core of PATCH /api/officers/{id}: takes an
 * OfficerProfileService + already-parsed inputs (or a raw Request) and
 * returns a Web Response. The route handler under app/api/officers/[id]/
 * is a thin adapter that builds the container and delegates here — so the
 * endpoint is unit-testable with a fake service and no running server.
 *
 * Mirrors handleUpdateAssetMetadata's shape: parse id, parse+validate body,
 * call the service, map OfficerNotFoundError to 404, else 200 with the result.
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound } from "@/lib/api/api_response";
import { officerIdParamSchema } from "@/lib/api/api_schemas";
import type { OfficerProfileService } from "@/lib/officer_profile/officer_profile_service";
import { officerProfileSaveSchema } from "@/lib/officer_profile/officer_profile_api_schemas";
import { OfficerNotFoundError } from "@/lib/officer_profile/officer_profile_types";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * PATCH /api/officers/{id} — batched save of profile/timeline/education/
 * training. Every section in the body is optional; timeline/education/
 * training (when present) REPLACE the persisted rows for that section.
 */
export async function handleOfficerProfileSave(
  service: OfficerProfileService,
  rawOfficerId: string,
  request: Request
): Promise<Response> {
  const paramParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!paramParsed.success) return badRequest("Invalid officer id", zodDetails(paramParsed.error));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const bodyParsed = officerProfileSaveSchema.safeParse(body);
  if (!bodyParsed.success) return badRequest("Invalid officer profile save request", zodDetails(bodyParsed.error));

  try {
    const result = await service.save(paramParsed.data.id, bodyParsed.data);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof OfficerNotFoundError) return notFound(error.message);
    throw error;
  }
}
