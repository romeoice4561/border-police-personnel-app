/**
 * DI-11D — Investigation Tasks API client.
 *
 * Collaboration routes authorize the HttpOnly `bppis_actor` cookie.
 * Writes send confirmActorId only — never trusted actor names.
 * No DELETE.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { DrugInvestigationTaskPriority, DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type {
  CollaborationAssigneeDto,
  CollaborationPageMeta,
  InvestigationTaskDto,
  InvestigationTaskPatchInput,
} from "@/lib/drug_intelligence/drug_collaboration_types";

interface ApiEnvelope<T> {
  data?: T;
  meta?: CollaborationPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface InvestigationTasksPage {
  items: InvestigationTaskDto[];
  meta: CollaborationPageMeta;
}

export interface InvestigationTaskListFilters {
  page?: number;
  pageSize?: number;
  status?: DrugInvestigationTaskStatus | "";
  overdueOnly?: boolean;
}

export interface InvestigationTaskCreateBody {
  title: string;
  description?: string | null;
  assignedActorId?: string | null;
  dueAt?: string | null;
  priority?: DrugInvestigationTaskPriority;
  confirmActorId: string;
}

const DEFAULT_META: CollaborationPageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

async function collaborationRequest<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta?: CollaborationPageMeta }> {
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

function listQuery(filters: InvestigationTaskListFilters): string {
  const search = new URLSearchParams();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? COLLABORATION_PAGE_DEFAULT;
  search.set("page", String(page));
  search.set("pageSize", String(pageSize));
  if (filters.overdueOnly) {
    search.set("overdue", "true");
  } else if (filters.status) {
    search.set("status", filters.status);
  }
  return `?${search.toString()}`;
}

export function investigationTaskCreatePayload(input: InvestigationTaskCreateBody): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title,
    confirmActorId: input.confirmActorId,
  };
  if (input.priority) body.priority = input.priority;
  if (input.description !== undefined) body.description = input.description;
  if (input.assignedActorId !== undefined) body.assignedActorId = input.assignedActorId;
  if (input.dueAt !== undefined) body.dueAt = input.dueAt;
  return body;
}

export function investigationTaskPatchPayload(
  patch: InvestigationTaskPatchInput,
  confirmActorId: string
): Record<string, unknown> {
  const body: Record<string, unknown> = { confirmActorId };
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.assignedActorId !== undefined) body.assignedActorId = patch.assignedActorId;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.dueAt !== undefined) {
    body.dueAt = patch.dueAt instanceof Date ? patch.dueAt.toISOString() : patch.dueAt;
  }
  return body;
}

export const drugInvestigationTasksClient = {
  async listCaseTasks(caseId: string, filters: InvestigationTaskListFilters = {}): Promise<InvestigationTasksPage> {
    const { data, meta } = await collaborationRequest<InvestigationTaskDto[]>(
      `/drug-intelligence/cases/${encodeURIComponent(caseId)}/tasks${listQuery(filters)}`
    );
    return { items: data, meta: meta ?? { ...DEFAULT_META, page: filters.page ?? 1, pageSize: filters.pageSize ?? COLLABORATION_PAGE_DEFAULT, total: data.length } };
  },

  async listPersonTasks(personId: string, filters: InvestigationTaskListFilters = {}): Promise<InvestigationTasksPage> {
    const { data, meta } = await collaborationRequest<InvestigationTaskDto[]>(
      `/drug-intelligence/persons/${encodeURIComponent(personId)}/tasks${listQuery(filters)}`
    );
    return { items: data, meta: meta ?? { ...DEFAULT_META, page: filters.page ?? 1, pageSize: filters.pageSize ?? COLLABORATION_PAGE_DEFAULT, total: data.length } };
  },

  async listAssignees(): Promise<CollaborationAssigneeDto[]> {
    return (await collaborationRequest<CollaborationAssigneeDto[]>(`/drug-intelligence/collaboration/assignees`)).data;
  },

  async createCaseTask(caseId: string, input: InvestigationTaskCreateBody): Promise<InvestigationTaskDto> {
    return (
      await collaborationRequest<InvestigationTaskDto>(`/drug-intelligence/cases/${encodeURIComponent(caseId)}/tasks`, {
        method: "POST",
        body: JSON.stringify(investigationTaskCreatePayload(input)),
      })
    ).data;
  },

  async createPersonTask(personId: string, input: InvestigationTaskCreateBody): Promise<InvestigationTaskDto> {
    return (
      await collaborationRequest<InvestigationTaskDto>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/tasks`, {
        method: "POST",
        body: JSON.stringify(investigationTaskCreatePayload(input)),
      })
    ).data;
  },

  async updateTask(taskId: string, patch: InvestigationTaskPatchInput, confirmActorId: string): Promise<InvestigationTaskDto> {
    return (
      await collaborationRequest<InvestigationTaskDto>(`/drug-intelligence/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify(investigationTaskPatchPayload(patch, confirmActorId)),
      })
    ).data;
  },
};
