/**
 * Officer Portrait API handlers (Phase 24B-1; history/set-current Phase 24B-2).
 *
 * Framework-agnostic core of the portrait endpoints. Each takes a
 * PortraitUploadService + already-resolved params (or a raw Request) and
 * returns a Web Response using the shared { data } / { error } envelope, so
 * they are unit-testable with a fake service and no running server.
 *
 *   POST   /api/officers/{id}/portrait  — upload/replace (multipart, field "file")
 *   GET    /api/officers/{id}/portrait  — current portrait metadata
 *   DELETE /api/officers/{id}/portrait  — remove current (soft; history kept)
 *   GET    /api/officers/{id}/portrait/history        — every portrait ever linked, newest first
 *   POST   /api/officers/{id}/portrait/history/{photoId}  — "Set as Current" (no re-upload)
 */

import { badRequest, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import { officerIdParamSchema } from "@/lib/api/api_schemas";
import { z } from "zod";
import { PortraitUploadError, type PortraitUploadService } from "@/lib/portrait/portrait_upload_service";
import type { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";

/** Maps a PortraitUploadError code to an HTTP status. */
function statusForCode(code: PortraitUploadError["code"]): number {
  switch (code) {
    case "UNSUPPORTED_TYPE":
    case "TOO_LARGE":
    case "EMPTY":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "STORAGE":
      return 502;
    default:
      return 400;
  }
}

function handleUploadError(error: unknown): Response {
  if (error instanceof PortraitUploadError) {
    return jsonError(error.code, error.message, statusForCode(error.code));
  }
  throw error;
}

/** POST — parse the multipart file and upload it as the officer's new portrait. */
export async function handlePortraitUpload(
  service: PortraitUploadService,
  rawOfficerId: string,
  request: Request,
  uploadedBy: string | null = null
): Promise<Response> {
  const paramParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!paramParsed.success) return badRequest("Invalid officer id");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Request must be multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("Missing 'file' in the upload.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  try {
    const portrait = await service.upload({
      officerId: paramParsed.data.id,
      bytes,
      mimeType,
      uploadedBy,
    });
    return jsonOk(portrait, undefined, 201);
  } catch (error) {
    return handleUploadError(error);
  }
}

/** GET — the officer's current portrait, or 404 when none. */
export async function handleGetCurrentPortrait(
  service: PortraitUploadService,
  rawOfficerId: string
): Promise<Response> {
  const paramParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!paramParsed.success) return badRequest("Invalid officer id");

  const portrait = await service.getCurrentPortrait(paramParsed.data.id);
  if (!portrait) return notFound("No portrait for this officer.");
  return jsonOk(portrait);
}

/** DELETE — remove the current portrait (soft; history preserved). */
export async function handlePortraitRemove(
  service: PortraitUploadService,
  rawOfficerId: string
): Promise<Response> {
  const paramParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!paramParsed.success) return badRequest("Invalid officer id");

  const portrait = await service.removeCurrent(paramParsed.data.id);
  return jsonOk({ current: portrait });
}

const photoIdParamSchema = z.object({ photoId: z.coerce.number().int().positive() });

/**
 * GET — every ProfilePhoto ever linked to this officer (current + history),
 * newest first. Never deletes/filters anything — the caller renders source,
 * upload date, Drive file, current badge, and verification status per row.
 */
export async function handlePortraitHistory(
  profilePhotoService: ProfilePhotoService,
  rawOfficerId: string
): Promise<Response> {
  const paramParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!paramParsed.success) return badRequest("Invalid officer id");

  const history = await profilePhotoService.history(paramParsed.data.id);
  return jsonOk(history);
}

/**
 * POST — "Set as Current" from the history panel: makes an existing
 * ProfilePhoto the officer's current portrait WITHOUT a new upload. Demotes
 * every other photo for that officer; never deletes anything. 404 if the
 * photo doesn't exist or isn't linked to this officer.
 */
export async function handleSetCurrentPortrait(
  profilePhotoService: ProfilePhotoService,
  rawOfficerId: string,
  rawPhotoId: string
): Promise<Response> {
  const paramParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!paramParsed.success) return badRequest("Invalid officer id");
  const photoIdParsed = photoIdParamSchema.safeParse({ photoId: rawPhotoId });
  if (!photoIdParsed.success) return badRequest("Invalid photo id");

  const existing = await profilePhotoService.getById(photoIdParsed.data.photoId);
  if (!existing || existing.matchedOfficerId !== paramParsed.data.id) {
    return notFound("No such portrait for this officer.");
  }

  const updated = await profilePhotoService.setCurrent(photoIdParsed.data.photoId);
  return jsonOk(updated);
}
