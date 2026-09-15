/**
 * DI-11C — Analyst Notes API client.
 *
 * Collaboration routes authorize the HttpOnly `bppis_actor` cookie, not the
 * legacy `actorId` query used by other Drug Intelligence APIs. Every call
 * therefore sends credentials. Writes always include confirmActorId; the
 * server remains authoritative for authorship.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type {
  AnalystNoteDto,
  CollaborationPageMeta,
  RelatedTaskNotesPage,
  ResultNoteSummaryDto,
  SourceTaskProvenanceDto,
} from "@/lib/drug_intelligence/drug_collaboration_types";

interface ApiEnvelope<T> {
  data?: T;
  meta?: CollaborationPageMeta & { sourceTasks?: SourceTaskProvenanceDto[] };
  error?: { code: string; message: string; details?: unknown };
}

export interface AnalystNotesPage {
  items: AnalystNoteDto[];
  meta: CollaborationPageMeta;
  sourceTasks: SourceTaskProvenanceDto[];
}

export interface AnalystNoteWriteBody {
  body: string;
  confirmActorId: string;
  sourceTaskId?: string | null;
}

export interface ResultNotesPage {
  items: ResultNoteSummaryDto[];
  meta: CollaborationPageMeta;
}

const DEFAULT_META: CollaborationPageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

async function collaborationRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; meta?: CollaborationPageMeta & { sourceTasks?: SourceTaskProvenanceDto[] } }> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let parsed: ApiEnvelope<T>;
  try {
    parsed = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || parsed.error) {
    const err = parsed.error;
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return { data: parsed.data as T, meta: parsed.meta };
}

function listQuery(page?: number, pageSize?: number): string {
  const search = new URLSearchParams();
  if (page != null) search.set("page", String(page));
  if (pageSize != null) search.set("pageSize", String(pageSize));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export function analystNoteCreatePayload(input: AnalystNoteWriteBody): Record<string, unknown> {
  const body: Record<string, unknown> = {
    body: input.body,
    confirmActorId: input.confirmActorId,
  };
  if (input.sourceTaskId != null && input.sourceTaskId !== "") body.sourceTaskId = input.sourceTaskId;
  return body;
}

export function analystNotePatchPayload(input: { body: string; confirmActorId: string }): Record<string, unknown> {
  return { body: input.body, confirmActorId: input.confirmActorId };
}

export const drugAnalystNotesClient = {
  async listCaseNotes(caseId: string, page = 1, pageSize = 20): Promise<AnalystNotesPage> {
    const { data, meta } = await collaborationRequest<AnalystNoteDto[]>(
      `/drug-intelligence/cases/${encodeURIComponent(caseId)}/notes${listQuery(page, pageSize)}`
    );
    return {
      items: data,
      meta: meta ?? { ...DEFAULT_META, page, pageSize, total: data.length },
      sourceTasks: Array.isArray(meta?.sourceTasks) ? meta.sourceTasks : [],
    };
  },

  async listPersonNotes(personId: string, page = 1, pageSize = 20): Promise<AnalystNotesPage> {
    const { data, meta } = await collaborationRequest<AnalystNoteDto[]>(
      `/drug-intelligence/persons/${encodeURIComponent(personId)}/notes${listQuery(page, pageSize)}`
    );
    return {
      items: data,
      meta: meta ?? { ...DEFAULT_META, page, pageSize, total: data.length },
      sourceTasks: Array.isArray(meta?.sourceTasks) ? meta.sourceTasks : [],
    };
  },

  async getNote(noteId: string): Promise<AnalystNoteDto> {
    return (await collaborationRequest<AnalystNoteDto>(`/drug-intelligence/notes/${encodeURIComponent(noteId)}`)).data;
  },

  async createCaseNote(caseId: string, input: AnalystNoteWriteBody): Promise<AnalystNoteDto> {
    return (
      await collaborationRequest<AnalystNoteDto>(`/drug-intelligence/cases/${encodeURIComponent(caseId)}/notes`, {
        method: "POST",
        body: JSON.stringify(analystNoteCreatePayload(input)),
      })
    ).data;
  },

  async createPersonNote(personId: string, input: AnalystNoteWriteBody): Promise<AnalystNoteDto> {
    return (
      await collaborationRequest<AnalystNoteDto>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/notes`, {
        method: "POST",
        body: JSON.stringify(analystNoteCreatePayload(input)),
      })
    ).data;
  },

  async updateNote(noteId: string, input: AnalystNoteWriteBody): Promise<AnalystNoteDto> {
    return (
      await collaborationRequest<AnalystNoteDto>(`/drug-intelligence/notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        body: JSON.stringify(analystNotePatchPayload({ body: input.body, confirmActorId: input.confirmActorId })),
      })
    ).data;
  },

  async listCaseTaskNotes(
    caseId: string,
    taskId: string,
    page = 1,
    pageSize = COLLABORATION_PAGE_DEFAULT
  ): Promise<ResultNotesPage> {
    const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const { data, meta } = await collaborationRequest<ResultNoteSummaryDto[]>(
      `/drug-intelligence/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}/notes?${search.toString()}`
    );
    return { items: data, meta: meta ?? { ...DEFAULT_META, page, pageSize, total: data.length } };
  },

  async listPersonTaskNotes(
    personId: string,
    taskId: string,
    page = 1,
    pageSize = COLLABORATION_PAGE_DEFAULT
  ): Promise<ResultNotesPage> {
    const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const { data, meta } = await collaborationRequest<ResultNoteSummaryDto[]>(
      `/drug-intelligence/persons/${encodeURIComponent(personId)}/tasks/${encodeURIComponent(taskId)}/notes?${search.toString()}`
    );
    return { items: data, meta: meta ?? { ...DEFAULT_META, page, pageSize, total: data.length } };
  },

  async listRelatedTaskNotesBatch(
    targetKind: "CASE" | "PERSON",
    targetId: string,
    taskIds: string[],
    page = 1,
    pageSize = COLLABORATION_PAGE_DEFAULT
  ): Promise<RelatedTaskNotesPage[]> {
    const search = new URLSearchParams({
      ids: taskIds.join(","),
      page: String(page),
      pageSize: String(pageSize),
    });
    const path =
      targetKind === "CASE"
        ? `/drug-intelligence/cases/${encodeURIComponent(targetId)}/related-task-notes?${search.toString()}`
        : `/drug-intelligence/persons/${encodeURIComponent(targetId)}/related-task-notes?${search.toString()}`;
    return (await collaborationRequest<RelatedTaskNotesPage[]>(path)).data;
  },
};
