/**
 * DI-11D — React Query hooks for Investigation Tasks.
 *
 * Reads use the bound `bppis_actor` cookie. Writes send confirmActorId from
 * the authenticated client user — never a client-supplied display name.
 */
"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/ui/api_client";
import {
  drugInvestigationTasksClient,
  type InvestigationTaskCreateBody,
  type InvestigationTaskListFilters,
  type InvestigationTasksPage,
} from "@/lib/drug_intelligence/drug_investigation_tasks_client";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationTargetKind, DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationAssigneeDto, InvestigationTaskDto, InvestigationTaskPatchInput } from "@/lib/drug_intelligence/drug_collaboration_types";

export interface InvestigationTasksQuery {
  page: number;
  status: DrugInvestigationTaskStatus | "";
  overdueOnly: boolean;
}

export const investigationTasksQueryKey = (
  targetKind: CollaborationTargetKind,
  targetId: string,
  query: InvestigationTasksQuery
) => ["drug-investigation-tasks", targetKind, targetId, query.page, query.status, query.overdueOnly] as const;

export function useInvestigationTasks(
  targetKind: CollaborationTargetKind,
  targetId: string,
  query: InvestigationTasksQuery
): UseQueryResult<InvestigationTasksPage> {
  const filters: InvestigationTaskListFilters = {
    page: query.page,
    pageSize: COLLABORATION_PAGE_DEFAULT,
    status: query.overdueOnly ? "" : query.status,
    overdueOnly: query.overdueOnly,
  };
  return useQuery({
    queryKey: investigationTasksQueryKey(targetKind, targetId, query),
    queryFn: () =>
      targetKind === "CASE"
        ? drugInvestigationTasksClient.listCaseTasks(targetId, filters)
        : drugInvestigationTasksClient.listPersonTasks(targetId, filters),
    enabled: targetId.length > 0 && query.page >= 1,
    placeholderData: keepPreviousData,
  });
}

export function useCollaborationAssignees(enabled = true): UseQueryResult<CollaborationAssigneeDto[]> {
  return useQuery({
    queryKey: ["drug-collaboration-assignees"],
    queryFn: () => drugInvestigationTasksClient.listAssignees(),
    enabled,
  });
}

function requireConfirmActorId(confirmActorId: string | null): string {
  if (!confirmActorId) {
    throw new ApiClientError("Bound collaboration session required", 401, "UNAUTHENTICATED");
  }
  return confirmActorId;
}

export function useCreateInvestigationTask(
  targetKind: CollaborationTargetKind,
  targetId: string,
  confirmActorId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<InvestigationTaskCreateBody, "confirmActorId">): Promise<InvestigationTaskDto> => {
      const body = { ...input, confirmActorId: requireConfirmActorId(confirmActorId) };
      return targetKind === "CASE"
        ? drugInvestigationTasksClient.createCaseTask(targetId, body)
        : drugInvestigationTasksClient.createPersonTask(targetId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-investigation-tasks", targetKind, targetId] });
    },
  });
}

export function useUpdateInvestigationTask(
  targetKind: CollaborationTargetKind,
  targetId: string,
  confirmActorId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      patch,
    }: {
      taskId: string;
      patch: InvestigationTaskPatchInput;
    }): Promise<InvestigationTaskDto> => {
      return drugInvestigationTasksClient.updateTask(taskId, patch, requireConfirmActorId(confirmActorId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-investigation-tasks", targetKind, targetId] });
    },
  });
}
