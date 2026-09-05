/**
 * Saved Investigation Board API handlers (DI-9.5B).
 *
 * Thin Zod + permission + service mapping. Actor identity comes from the
 * authenticated request actor fields (actorId/actorName) after permission
 * check — owner* fields are never accepted from the client.
 */

import { z } from "zod";
import { badRequest, conflict, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import {
  assertBoardStatePayloadSize,
  drugInvestigationBoardArchiveSchema,
  drugInvestigationBoardCreateSchema,
  drugInvestigationBoardDuplicateSchema,
  drugInvestigationBoardGetQuerySchema,
  drugInvestigationBoardIdSchema,
  drugInvestigationBoardListQuerySchema,
  drugInvestigationBoardUpdateSchema,
} from "@/lib/drug_intelligence/drug_investigation_board_api_schemas";
import {
  BoardConflictError,
  BoardForbiddenError,
  BoardNotFoundError,
  BoardPayloadTooLargeError,
  type DrugInvestigationBoardRecord,
  type DrugInvestigationBoardSummary,
} from "@/lib/drug_intelligence/drug_investigation_board_types";
import type { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function serializeBoard(board: DrugInvestigationBoardRecord) {
  return {
    ...board,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    lastOpenedAt: board.lastOpenedAt ? board.lastOpenedAt.toISOString() : null,
  };
}

function serializeSummary(board: DrugInvestigationBoardSummary) {
  return {
    ...board,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    lastOpenedAt: board.lastOpenedAt ? board.lastOpenedAt.toISOString() : null,
  };
}

function mapServiceError(error: unknown): Response | null {
  if (error instanceof BoardNotFoundError) return notFound("Investigation board not found");
  if (error instanceof BoardForbiddenError) return jsonError("FORBIDDEN", error.message, 403);
  if (error instanceof BoardConflictError) {
    return conflict("This board changed elsewhere", {
      currentVersion: error.currentVersion,
      expectedVersion: error.expectedVersion,
      title: error.title,
      updatedAt: error.updatedAt.toISOString(),
    });
  }
  if (error instanceof BoardPayloadTooLargeError) {
    return jsonError("PAYLOAD_TOO_LARGE", error.message, 413, { bytes: error.bytes });
  }
  return null;
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: badRequest("Request body must be valid JSON") };
  }
}

/** GET /api/drug-intelligence/boards */
export async function handleInvestigationBoardList(
  service: DrugInvestigationBoardService,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = drugInvestigationBoardListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid board list query", zodDetails(parsed.error));
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;
  try {
    const boards = await service.listBoards(
      { actorId: parsed.data.actorId, actorName: "" },
      parsed.data.status ?? "ACTIVE"
    );
    return jsonOk({ boards: boards.map(serializeSummary) });
  } catch (error) {
    return mapServiceError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list investigation boards", 500);
  }
}

/** POST /api/drug-intelligence/boards */
export async function handleInvestigationBoardCreate(
  service: DrugInvestigationBoardService,
  request: Request
): Promise<Response> {
  const json = await readJson(request);
  if (!json.ok) return json.response;
  if (json.body && typeof json.body === "object" && "state" in json.body) {
    const sized = assertBoardStatePayloadSize((json.body as { state: unknown }).state);
    if (!sized.ok) return jsonError("PAYLOAD_TOO_LARGE", "Board state exceeds 1 MB limit", 413, { bytes: sized.bytes });
  }
  const parsed = drugInvestigationBoardCreateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid board create request", zodDetails(parsed.error));
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    const board = await service.createBoard(
      { actorId: parsed.data.actorId, actorName: parsed.data.actorName },
      {
        title: parsed.data.title,
        description: parsed.data.description,
        state: parsed.data.state,
        sourceBoardId: parsed.data.sourceBoardId,
      }
    );
    return jsonOk(serializeBoard(board), undefined, 201);
  } catch (error) {
    return mapServiceError(error) ?? jsonError("INTERNAL_ERROR", "Failed to create investigation board", 500);
  }
}

/** GET /api/drug-intelligence/boards/[id] */
export async function handleInvestigationBoardGet(
  service: DrugInvestigationBoardService,
  id: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const idParsed = drugInvestigationBoardIdSchema.safeParse(id);
  if (!idParsed.success) return badRequest("Invalid board id", zodDetails(idParsed.error));
  const parsed = drugInvestigationBoardGetQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid board get query", zodDetails(parsed.error));
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;
  try {
    const board = await service.getBoard(idParsed.data, { actorId: parsed.data.actorId, actorName: "" });
    return jsonOk(serializeBoard(board));
  } catch (error) {
    return mapServiceError(error) ?? jsonError("INTERNAL_ERROR", "Failed to load investigation board", 500);
  }
}

/** PATCH /api/drug-intelligence/boards/[id] */
export async function handleInvestigationBoardUpdate(
  service: DrugInvestigationBoardService,
  id: string,
  request: Request
): Promise<Response> {
  const idParsed = drugInvestigationBoardIdSchema.safeParse(id);
  if (!idParsed.success) return badRequest("Invalid board id", zodDetails(idParsed.error));
  const json = await readJson(request);
  if (!json.ok) return json.response;
  if (json.body && typeof json.body === "object" && "state" in json.body && (json.body as { state?: unknown }).state !== undefined) {
    const sized = assertBoardStatePayloadSize((json.body as { state: unknown }).state);
    if (!sized.ok) return jsonError("PAYLOAD_TOO_LARGE", "Board state exceeds 1 MB limit", 413, { bytes: sized.bytes });
  }
  const parsed = drugInvestigationBoardUpdateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid board update request", zodDetails(parsed.error));
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    const board = await service.updateBoard(idParsed.data, { actorId: parsed.data.actorId, actorName: parsed.data.actorName }, {
      expectedVersion: parsed.data.expectedVersion,
      title: parsed.data.title,
      description: parsed.data.description,
      state: parsed.data.state,
    });
    return jsonOk(serializeBoard(board));
  } catch (error) {
    return mapServiceError(error) ?? jsonError("INTERNAL_ERROR", "Failed to update investigation board", 500);
  }
}

/** POST /api/drug-intelligence/boards/[id]/duplicate */
export async function handleInvestigationBoardDuplicate(
  service: DrugInvestigationBoardService,
  id: string,
  request: Request
): Promise<Response> {
  const idParsed = drugInvestigationBoardIdSchema.safeParse(id);
  if (!idParsed.success) return badRequest("Invalid board id", zodDetails(idParsed.error));
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = drugInvestigationBoardDuplicateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid board duplicate request", zodDetails(parsed.error));
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    const board = await service.duplicateBoard(idParsed.data, { actorId: parsed.data.actorId, actorName: parsed.data.actorName }, parsed.data.title);
    return jsonOk(serializeBoard(board), undefined, 201);
  } catch (error) {
    return mapServiceError(error) ?? jsonError("INTERNAL_ERROR", "Failed to duplicate investigation board", 500);
  }
}

/** POST /api/drug-intelligence/boards/[id]/archive */
export async function handleInvestigationBoardArchive(
  service: DrugInvestigationBoardService,
  id: string,
  request: Request
): Promise<Response> {
  const idParsed = drugInvestigationBoardIdSchema.safeParse(id);
  if (!idParsed.success) return badRequest("Invalid board id", zodDetails(idParsed.error));
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = drugInvestigationBoardArchiveSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid board archive request", zodDetails(parsed.error));
  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;
  try {
    const board = await service.archiveBoard(idParsed.data, { actorId: parsed.data.actorId, actorName: parsed.data.actorName });
    return jsonOk(serializeBoard(board));
  } catch (error) {
    return mapServiceError(error) ?? jsonError("INTERNAL_ERROR", "Failed to archive investigation board", 500);
  }
}
