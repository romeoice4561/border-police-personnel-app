/**
 * DI-11D.1 — Investigation Tasks API client (reads only).
 *
 * Collaboration routes authorize the HttpOnly `bppis_actor` cookie.
 * No POST/PATCH in this client.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type {
  CollaborationAssigneeDto,
  CollaborationPageMeta,
  InvestigationTaskDto,
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

const DEFAULT_META: CollaborationPageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

async function collaborationRequest<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta?: CollaborationPageMeta }> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

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
};
