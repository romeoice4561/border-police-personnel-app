/**
 * Investigation-board image API handlers (DI-9.5D).
 *
 * Flat /board-images routes — same depth as /boards/{id} so Turbopack and
 * production both register them. Nested /boards/{id}/images is not used.
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk, notFound, serviceUnavailable } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { BoardForbiddenError, BoardNotFoundError } from "@/lib/drug_intelligence/drug_investigation_board_types";
import {
  BoardImageReadOnlyError,
  BoardImageUnavailableError,
  BoardImageValidationError,
  type DrugInvestigationBoardImageService,
} from "@/lib/drug_intelligence/drug_investigation_board_image_service";
import { BoardImageStorageConfigError } from "@/lib/drug_intelligence/drug_investigation_board_image_storage";

const actorFields = {
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
};

const uploadFieldsSchema = z.object({
  ...actorFields,
  boardId: z.string().trim().min(1).max(80),
});

const accessQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  boardId: z.string().trim().min(1).max(80),
  imageId: z.string().trim().min(1).max(80).optional(),
  ids: z.string().trim().max(4000).optional(),
});

const deleteSchema = z.object({
  ...actorFields,
  boardId: z.string().trim().min(1).max(80),
  imageId: z.string().trim().min(1).max(80),
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
  if (error instanceof BoardImageReadOnlyError) {
    return jsonError("BOARD_READ_ONLY", error.message, 403);
  }
  if (error instanceof BoardImageUnavailableError) {
    return jsonError("IMAGE_UNAVAILABLE", error.message, 404);
  }
  if (error instanceof BoardNotFoundError) return notFound("Investigation board not found");
  if (error instanceof BoardForbiddenError) return jsonError("FORBIDDEN", error.message, 403);
  if (error instanceof BoardImageStorageConfigError) {
    return serviceUnavailable("Private image storage is not available");
  }
  return null;
}

export async function handleBoardImageUpload(
  service: DrugInvestigationBoardImageService,
  request: Request
): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Request must be multipart/form-data with a file field.");
  }
  const parsed = uploadFieldsSchema.safeParse({
    actorId: String(form.get("actorId") ?? ""),
    actorName: String(form.get("actorName") ?? ""),
    boardId: String(form.get("boardId") ?? ""),
  });
  if (!parsed.success) return badRequest("Invalid image upload request");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Missing file in the upload.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const image = await service.upload(parsed.data.boardId, parsed.data, {
      bytes,
      declaredMime: file.type,
      originalName: file.name,
    });
    return jsonOk(
      {
        id: image.id,
        boardId: image.boardId,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        width: image.width,
        height: image.height,
        createdAt: image.createdAt.toISOString(),
      },
      undefined,
      201
    );
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to upload board image", 500);
  }
}

export async function handleBoardImageAccess(
  service: DrugInvestigationBoardImageService,
  request: Request
): Promise<Response> {
  const parsed = accessQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return badRequest("Invalid image access request");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;
  const ids = parsed.data.ids
    ? parsed.data.ids.split(",").map((id) => id.trim()).filter(Boolean)
    : parsed.data.imageId
      ? [parsed.data.imageId]
      : [];
  if (ids.length === 0) return badRequest("imageId or ids is required");
  try {
    const images = await service.accessMany(parsed.data.boardId, ids, {
      actorId: parsed.data.actorId,
      actorName: "reader",
    });
    return jsonOk({ images });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to resolve board image", 500);
  }
}

export async function handleBoardImageDelete(
  service: DrugInvestigationBoardImageService,
  request: Request
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid image delete request");
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    await service.remove(parsed.data.boardId, parsed.data.imageId, parsed.data);
    return jsonOk({ ok: true });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to remove board image", 500);
  }
}
