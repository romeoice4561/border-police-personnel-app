/**
 * Profile Photo review/cleanup API handlers (Phase 24B-2 — Legacy Portrait
 * Verification & Drive Cleanup).
 *
 * Framework-agnostic core for the admin cleanup tool: list ProfilePhotos with
 * filters (classification/matchStatus/region/company/battalion/search) and
 * classify one photo. Each takes a ProfilePhotoService + already-parsed
 * inputs (or a raw Request) and returns a Web Response with the shared
 * envelope, so they are unit-testable with a fake service and no running
 * server. This is a management UI only — it never touches OCR.
 *
 *   GET  /api/profile-photos            — list + filter (paginated)
 *   GET  /api/profile-photos/counts     — per-classification counts (filter chips)
 *   POST /api/profile-photos/{id}/classify — set one photo's classification
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound } from "@/lib/api/api_response";
import { searchParamsToObject } from "@/lib/api/api_schemas";
import type { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { MatchStatus, PortraitClassification } from "@/lib/profile_photo/profile_photo_types";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  classification: z.nativeEnum(PortraitClassification).optional(),
  matchStatus: z.nativeEnum(MatchStatus).optional(),
  region: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
  battalion: z.string().trim().min(1).optional(),
  /** Free-text search by officer id or Drive file id (spec: "Search by officer", "Search by Drive file"). */
  search: z.string().trim().min(1).optional(),
});

/** GET /api/profile-photos — paginated, filtered list for the cleanup tool. */
export async function handleListProfilePhotos(service: ProfilePhotoService, url: URL): Promise<Response> {
  const parsed = listQuerySchema.safeParse(searchParamsToObject(url.searchParams));
  if (!parsed.success) return badRequest("Invalid query", parsed.error.issues);

  const result = await service.list(parsed.data);
  return jsonOk(result.data, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  });
}

/** GET /api/profile-photos/counts — per-classification counts for filter chips. */
export async function handleClassificationCounts(service: ProfilePhotoService): Promise<Response> {
  const counts = await service.classificationCounts();
  return jsonOk(counts);
}

const photoIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const classifyBodySchema = z.object({
  classification: z.nativeEnum(PortraitClassification),
  /** Reviewer actor id (optional free text — no auth system exists yet to derive it from). */
  classifiedBy: z.string().trim().min(1).max(200).optional(),
});

/**
 * POST /api/profile-photos/{id}/classify — a Gallery reviewer marks what one
 * photo's image actually shows. The resolver immediately respects this on the
 * next read (no cache to invalidate — it queries live).
 */
export async function handleClassifyProfilePhoto(
  service: ProfilePhotoService,
  rawId: string,
  request: Request
): Promise<Response> {
  const idParsed = photoIdParamSchema.safeParse({ id: rawId });
  if (!idParsed.success) return badRequest("Invalid photo id");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const bodyParsed = classifyBodySchema.safeParse(body);
  if (!bodyParsed.success) return badRequest("Invalid classify request", bodyParsed.error.issues);

  const updated = await service.classify(idParsed.data.id, bodyParsed.data.classification, bodyParsed.data.classifiedBy ?? null);
  if (!updated) return notFound("No such profile photo.");
  return jsonOk(updated);
}

const bulkClassifyBodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  classification: z.nativeEnum(PortraitClassification),
  classifiedBy: z.string().trim().min(1).max(200).optional(),
});

/**
 * POST /api/profile-photos/bulk-classify — bulk verify/reject across many
 * photos at once (spec: "Bulk verify", "Bulk reject"). Applies classify() to
 * each id sequentially; a missing id is simply skipped (best-effort, reports
 * how many actually updated) rather than failing the whole batch.
 */
export async function handleBulkClassifyProfilePhotos(service: ProfilePhotoService, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const parsed = bulkClassifyBodySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid bulk classify request", parsed.error.issues);

  let updated = 0;
  for (const id of parsed.data.ids) {
    const result = await service.classify(id, parsed.data.classification, parsed.data.classifiedBy ?? null);
    if (result) updated += 1;
  }
  return jsonOk({ requested: parsed.data.ids.length, updated });
}
