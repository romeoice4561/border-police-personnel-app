/**
 * Entity Media API handlers. Flat /entity-media routes.
 * drug.read for list/access; drug.edit for upload/update/delete/primary.
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk, notFound, serviceUnavailable } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { BoardImageStorageConfigError } from "@/lib/drug_intelligence/drug_investigation_board_image_storage";
import { BoardImageValidationError } from "@/lib/drug_intelligence/drug_investigation_board_image_validation";
import { DRUG_ENTITY_MEDIA_ENTITY_TYPES, visualLookupKey } from "@/lib/drug_intelligence/drug_entity_media_types";
import type { DrugEntityMediaService } from "@/lib/drug_intelligence/drug_entity_media_service";
import {
  EntityMediaCategoryError,
  EntityMediaMergedWriteError,
  EntityMediaNotFoundError,
  EntityMediaTargetNotFoundError,
  parseEntityMediaType,
} from "@/lib/drug_intelligence/drug_entity_media_validation";

const actorFields = {
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
};

const listQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  entityType: z.enum(DRUG_ENTITY_MEDIA_ENTITY_TYPES),
  entityId: z.string().trim().min(1).max(80),
});

const primariesQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  refs: z.string().trim().max(8000),
});

const patchSchema = z.object({
  ...actorFields,
  category: z.string().trim().max(40).optional(),
  caption: z.string().trim().max(400).optional().nullable(),
  description: z.string().trim().max(400).optional().nullable(),
  sourceCaseId: z.string().trim().max(80).optional().nullable(),
  capturedAt: z.string().trim().max(40).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

const deleteSchema = z.object({
  ...actorFields,
});

function validationMessage(code: BoardImageValidationError["code"]): { status: number; message: string } {
  switch (code) {
    case "EMPTY":
      return { status: 400, message: "The image file is empty." };
    case "TOO_LARGE":
      return { status: 400, message: "The image is too large. Maximum size is 10 MB." };
    case "UNSUPPORTED_TYPE":
    case "SIGNATURE_MISMATCH":
      return { status: 400, message: "Unsupported image format. Use JPEG, PNG, WEBP, or GIF." };
    case "DIMENSIONS":
      return { status: 400, message: "The image dimensions are not allowed." };
    default:
      return { status: 400, message: "The image could not be accepted." };
  }
}

function mapError(error: unknown): Response | null {
  if (error instanceof BoardImageValidationError) {
    const mapped = validationMessage(error.code);
    return jsonError(error.code, mapped.message, mapped.status);
  }
  if (error instanceof EntityMediaCategoryError) return badRequest(error.message);
  if (error instanceof EntityMediaNotFoundError) return notFound("Media is unavailable");
  if (error instanceof EntityMediaTargetNotFoundError) return notFound(error.message);
  if (error instanceof EntityMediaMergedWriteError) return jsonError("MERGED_PERSON", error.message, 409);
  if (error instanceof BoardImageStorageConfigError) {
    return serviceUnavailable("Private image storage is not available");
  }
  return null;
}

export async function handleEntityMediaList(
  service: DrugEntityMediaService,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid media query");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;
  try {
    return jsonOk(await service.list(parsed.data.entityType, parsed.data.entityId));
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to load media", 500);
  }
}

export async function handleEntityMediaPrimaries(
  service: DrugEntityMediaService,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = primariesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid media query");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;
  const refs = parseRefs(parsed.data.refs);
  const visuals = await service.visualsFor(refs);
  return jsonOk(
    refs.map((ref) => ({
      entityType: ref.entityType,
      entityId: ref.entityId,
      visual: visuals.get(visualLookupKey(ref.entityType, ref.entityId)) ?? null,
    }))
  );
}

export async function handleEntityMediaUpload(
  service: DrugEntityMediaService,
  request: Request
): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Request must be multipart/form-data with a file field.");
  }
  const actorId = String(form.get("actorId") ?? "");
  const actorName = String(form.get("actorName") ?? "");
  if (!actorId || !actorName) return badRequest("Invalid media upload request");
  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.edit");
  if (denied) return denied;

  let entityType;
  try {
    entityType = parseEntityMediaType(String(form.get("entityType") ?? ""));
  } catch {
    return badRequest("Invalid entity type");
  }
  const entityId = String(form.get("entityId") ?? "").trim();
  if (!entityId) return badRequest("Missing entityId");

  const files = form.getAll("file").filter((item): item is File => item instanceof File);
  if (files.length === 0) return badRequest("Missing file in the upload.");

  const category = optionalForm(form, "category");
  const caption = optionalForm(form, "caption");
  const description = optionalForm(form, "description");
  const sourceCaseId = optionalForm(form, "sourceCaseId");
  const capturedAt = optionalForm(form, "capturedAt");
  const setPrimary = String(form.get("setPrimary") ?? "") === "true";

  try {
    const uploaded = [];
    for (const [index, file] of files.entries()) {
      uploaded.push(
        await service.upload(
          {
            entityType,
            entityId,
            category,
            caption,
            description,
            sourceCaseId,
            capturedAt,
            setPrimary: setPrimary && index === 0,
            bytes: new Uint8Array(await file.arrayBuffer()),
            declaredMime: file.type,
            originalName: file.name,
          },
          { actorId, actorName }
        )
      );
    }
    return jsonOk(uploaded.length === 1 ? uploaded[0] : { items: uploaded }, undefined, 201);
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to upload media", 500);
  }
}

export async function handleEntityMediaPatch(
  service: DrugEntityMediaService,
  mediaId: string,
  request: Request
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid media update");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    const { actorId, actorName, ...patch } = parsed.data;
    return jsonOk(await service.update(mediaId, patch, { actorId, actorName }));
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to update media", 500);
  }
}

export async function handleEntityMediaDelete(
  service: DrugEntityMediaService,
  mediaId: string,
  request: Request
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid media delete");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    await service.remove(mediaId, parsed.data);
    return jsonOk({ ok: true });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to delete media", 500);
  }
}

function optionalForm(form: FormData, key: string): string | null {
  const value = String(form.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function parseRefs(raw: string): Array<{ entityType: string; entityId: string }> {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 160)
    .map((part) => {
      const [entityType, ...rest] = part.split(":");
      return { entityType: (entityType ?? "").toUpperCase(), entityId: rest.join(":") };
    })
    .filter((ref) => ref.entityType && ref.entityId);
}
