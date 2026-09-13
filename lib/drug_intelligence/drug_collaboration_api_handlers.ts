/**
 * DI-11B collaboration API handlers.
 *
 * Permission is checked against the bound session actor BEFORE target lookup.
 * Client actorId/actorName are ignored. Writes require confirmActorId matching
 * the bound cookie actor (blocks cross-tab misattribution). No DELETE routes.
 */

import { z } from "zod";
import { badRequest, conflict, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import {
  COLLABORATION_PAGE_DEFAULT,
  RELATED_NOTE_TASKS_BATCH_MAX_IDS,
  RELATED_NOTE_TASKS_BATCH_RAW_MAX,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import {
  assertCollaborationPermission,
  assertConfirmActorId,
  listAssignableCollaborationActors,
  toCollaborationAssigneeDto,
} from "@/lib/drug_intelligence/drug_collaboration_auth";
import {
  analystNoteCreateSchema,
  analystNoteUpdateSchema,
  collaborationListQuerySchema,
  collaborationResourceIdSchema,
  investigationTaskCreateSchema,
  investigationTaskListQuerySchema,
  investigationTaskPatchSchema,
} from "@/lib/drug_intelligence/drug_collaboration_api_schemas";
import type { DrugAnalystNoteService } from "@/lib/drug_intelligence/drug_analyst_note_service";
import type { DrugInvestigationTaskService } from "@/lib/drug_intelligence/drug_investigation_task_service";
import {
  CollaborationInvalidAssigneeError,
  CollaborationInvalidTransitionError,
  CollaborationNotFoundError,
  CollaborationPersonMergedError,
  CollaborationTargetNotFoundError,
  CollaborationValidationError,
} from "@/lib/drug_intelligence/drug_collaboration_types";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

function mapError(error: unknown): Response | null {
  if (error instanceof CollaborationValidationError) return badRequest(error.message);
  if (error instanceof CollaborationInvalidAssigneeError) return badRequest(error.message);
  if (error instanceof CollaborationInvalidTransitionError) return badRequest(error.message);
  if (error instanceof CollaborationTargetNotFoundError) return notFound(error.message);
  if (error instanceof CollaborationNotFoundError) return notFound(error.message);
  if (error instanceof CollaborationPersonMergedError) {
    return conflict(error.message, { personId: error.personId, survivorPersonId: error.survivorPersonId });
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

function parseId(id: string): { ok: true; id: string } | { ok: false; response: Response } {
  const parsed = collaborationResourceIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, response: badRequest("Invalid id", zodDetails(parsed.error)) };
  return { ok: true, id: parsed.data };
}

export async function handleCaseNotesList(
  service: DrugAnalystNoteService,
  caseId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const id = parseId(caseId);
  if (!id.ok) return id.response;
  const query = collaborationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return badRequest("Invalid note list query", zodDetails(query.error));
  try {
    const result = await service.listForCase(id.id, query.data);
    return jsonOk(result.items, { ...result.meta });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list analyst notes", 500);
  }
}

export async function handleCaseNotesCreate(
  service: DrugAnalystNoteService,
  caseId: string,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.edit");
  if (!gated.ok) return gated.response;
  const id = parseId(caseId);
  if (!id.ok) return id.response;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const confirmed = assertConfirmActorId(json.body, gated.actor.actorId);
  if (!confirmed.ok) return confirmed.response;
  const parsed = analystNoteCreateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid analyst note", zodDetails(parsed.error));
  try {
    const note = await service.createForCase(id.id, parsed.data, gated.actor);
    return jsonOk(note, undefined, 201);
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to create analyst note", 500);
  }
}

export async function handlePersonNotesList(
  service: DrugAnalystNoteService,
  personId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const id = parseId(personId);
  if (!id.ok) return id.response;
  const query = collaborationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return badRequest("Invalid note list query", zodDetails(query.error));
  try {
    const result = await service.listForPerson(id.id, query.data);
    return jsonOk(result.items, { ...result.meta });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list analyst notes", 500);
  }
}

export async function handlePersonNotesCreate(
  service: DrugAnalystNoteService,
  personId: string,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.edit");
  if (!gated.ok) return gated.response;
  const id = parseId(personId);
  if (!id.ok) return id.response;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const confirmed = assertConfirmActorId(json.body, gated.actor.actorId);
  if (!confirmed.ok) return confirmed.response;
  const parsed = analystNoteCreateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid analyst note", zodDetails(parsed.error));
  try {
    const note = await service.createForPerson(id.id, parsed.data, gated.actor);
    return jsonOk(note, undefined, 201);
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to create analyst note", 500);
  }
}

export async function handleNoteGet(service: DrugAnalystNoteService, noteId: string, request: Request): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const id = parseId(noteId);
  if (!id.ok) return id.response;
  try {
    return jsonOk(await service.get(id.id));
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to load analyst note", 500);
  }
}

export async function handleNotePatch(service: DrugAnalystNoteService, noteId: string, request: Request): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.edit");
  if (!gated.ok) return gated.response;
  const id = parseId(noteId);
  if (!id.ok) return id.response;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const confirmed = assertConfirmActorId(json.body, gated.actor.actorId);
  if (!confirmed.ok) return confirmed.response;
  const parsed = analystNoteUpdateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid analyst note", zodDetails(parsed.error));
  try {
    return jsonOk(await service.update(id.id, parsed.data, gated.actor));
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to update analyst note", 500);
  }
}

export async function handleCaseTasksList(
  service: DrugInvestigationTaskService,
  caseId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const id = parseId(caseId);
  if (!id.ok) return id.response;
  const query = investigationTaskListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return badRequest("Invalid task list query", zodDetails(query.error));
  try {
    const result = await service.listForCase(id.id, query.data);
    return jsonOk(result.items, { ...result.meta, sourceNotes: result.sourceNotes });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list investigation tasks", 500);
  }
}

export async function handleCaseTasksCreate(
  service: DrugInvestigationTaskService,
  caseId: string,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.edit");
  if (!gated.ok) return gated.response;
  const id = parseId(caseId);
  if (!id.ok) return id.response;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const confirmed = assertConfirmActorId(json.body, gated.actor.actorId);
  if (!confirmed.ok) return confirmed.response;
  const parsed = investigationTaskCreateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid investigation task", zodDetails(parsed.error));
  try {
    const task = await service.createForCase(id.id, parsed.data, gated.actor);
    return jsonOk(task, undefined, 201);
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to create investigation task", 500);
  }
}

export async function handlePersonTasksList(
  service: DrugInvestigationTaskService,
  personId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const id = parseId(personId);
  if (!id.ok) return id.response;
  const query = investigationTaskListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return badRequest("Invalid task list query", zodDetails(query.error));
  try {
    const result = await service.listForPerson(id.id, query.data);
    return jsonOk(result.items, { ...result.meta, sourceNotes: result.sourceNotes });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list investigation tasks", 500);
  }
}

export async function handlePersonTasksCreate(
  service: DrugInvestigationTaskService,
  personId: string,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.edit");
  if (!gated.ok) return gated.response;
  const id = parseId(personId);
  if (!id.ok) return id.response;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const confirmed = assertConfirmActorId(json.body, gated.actor.actorId);
  if (!confirmed.ok) return confirmed.response;
  const parsed = investigationTaskCreateSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid investigation task", zodDetails(parsed.error));
  try {
    const task = await service.createForPerson(id.id, parsed.data, gated.actor);
    return jsonOk(task, undefined, 201);
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to create investigation task", 500);
  }
}

export async function handleTaskGet(service: DrugInvestigationTaskService, taskId: string, request: Request): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const id = parseId(taskId);
  if (!id.ok) return id.response;
  try {
    return jsonOk(await service.get(id.id));
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to load investigation task", 500);
  }
}

export async function handleCollaborationAssignees(request: Request): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const users = await listAssignableCollaborationActors();
  return jsonOk(users.map(toCollaborationAssigneeDto));
}

export async function handleCaseNoteRelatedTasksList(
  service: DrugInvestigationTaskService,
  caseId: string,
  noteId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const target = parseId(caseId);
  if (!target.ok) return target.response;
  const note = parseId(noteId);
  if (!note.ok) return note.response;
  const query = collaborationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return badRequest("Invalid related task list query", zodDetails(query.error));
  try {
    const result = await service.listForTargetSourceNote("CASE", target.id, note.id, query.data);
    return jsonOk(result.items, { ...result.meta });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list related investigation tasks", 500);
  }
}

export async function handlePersonNoteRelatedTasksList(
  service: DrugInvestigationTaskService,
  personId: string,
  noteId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const target = parseId(personId);
  if (!target.ok) return target.response;
  const note = parseId(noteId);
  if (!note.ok) return note.response;
  const query = collaborationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return badRequest("Invalid related task list query", zodDetails(query.error));
  try {
    const result = await service.listForTargetSourceNote("PERSON", target.id, note.id, query.data);
    return jsonOk(result.items, { ...result.meta });
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list related investigation tasks", 500);
  }
}

export async function handleCaseRelatedNoteTasksBatch(
  service: DrugInvestigationTaskService,
  caseId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  return handleRelatedNoteTasksBatch(service, "CASE", caseId, searchParams, request);
}

export async function handlePersonRelatedNoteTasksBatch(
  service: DrugInvestigationTaskService,
  personId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  return handleRelatedNoteTasksBatch(service, "PERSON", personId, searchParams, request);
}

async function handleRelatedNoteTasksBatch(
  service: DrugInvestigationTaskService,
  kind: "CASE" | "PERSON",
  targetId: string,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.read");
  if (!gated.ok) return gated.response;
  const target = parseId(targetId);
  if (!target.ok) return target.response;
  const rawIds = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (rawIds.length < 1) return badRequest("ids is required");
  if (rawIds.length > RELATED_NOTE_TASKS_BATCH_RAW_MAX) return badRequest("Too many ids");
  const parsedIds = rawIds.map((id) => collaborationResourceIdSchema.safeParse(id));
  if (parsedIds.some((id) => !id.success)) return badRequest("Invalid related-task note ids");
  const unique = [...new Set(parsedIds.map((id) => id.data as string))];
  if (unique.length > RELATED_NOTE_TASKS_BATCH_MAX_IDS) return badRequest("Too many ids");
  try {
    const result = await service.listForTargetSourceNotes(kind, target.id, unique, {
      page: 1,
      pageSize: COLLABORATION_PAGE_DEFAULT,
    });
    return jsonOk(result);
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to list related investigation tasks", 500);
  }
}

export async function handleTaskPatch(service: DrugInvestigationTaskService, taskId: string, request: Request): Promise<Response> {
  const gated = await assertCollaborationPermission(request, "drug.edit");
  if (!gated.ok) return gated.response;
  const id = parseId(taskId);
  if (!id.ok) return id.response;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const confirmed = assertConfirmActorId(json.body, gated.actor.actorId);
  if (!confirmed.ok) return confirmed.response;
  const parsed = investigationTaskPatchSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid investigation task", zodDetails(parsed.error));
  try {
    return jsonOk(await service.update(id.id, parsed.data, gated.actor));
  } catch (error) {
    return mapError(error) ?? jsonError("INTERNAL_ERROR", "Failed to update investigation task", 500);
  }
}
