/**
 * DI-11D.1 — React Query hooks for Investigation Tasks (reads only).
 */
"use client";

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import {
  drugInvestigationTasksClient,
  type InvestigationTaskListFilters,
  type InvestigationTasksPage,
} from "@/lib/drug_intelligence/drug_investigation_tasks_client";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationTargetKind, DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationAssigneeDto } from "@/lib/drug_intelligence/drug_collaboration_types";

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

export function useCollaborationAssignees(): UseQueryResult<CollaborationAssigneeDto[]> {
  return useQuery({
    queryKey: ["drug-collaboration-assignees"],
    queryFn: () => drugInvestigationTasksClient.listAssignees(),
  });
}
