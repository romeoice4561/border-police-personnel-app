/**
 * DI-11C — React Query hooks for Analyst Notes.
 *
 * Reads use the bound `bppis_actor` cookie. Writes send confirmActorId from
 * the authenticated client user — never a client-supplied display name.
 */
"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/ui/api_client";
import { drugAnalystNotesClient, type AnalystNotesPage } from "@/lib/drug_intelligence/drug_analyst_notes_client";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationTargetKind } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { AnalystNoteDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export const analystNotesQueryKey = (
  targetKind: CollaborationTargetKind,
  targetId: string,
  page: number
) => ["drug-analyst-notes", targetKind, targetId, page] as const;

export function useAnalystNotes(
  targetKind: CollaborationTargetKind,
  targetId: string,
  page: number
): UseQueryResult<AnalystNotesPage> {
  return useQuery({
    queryKey: analystNotesQueryKey(targetKind, targetId, page),
    queryFn: () =>
      targetKind === "CASE"
        ? drugAnalystNotesClient.listCaseNotes(targetId, page, COLLABORATION_PAGE_DEFAULT)
        : drugAnalystNotesClient.listPersonNotes(targetId, page, COLLABORATION_PAGE_DEFAULT),
    enabled: targetId.length > 0 && page >= 1,
    placeholderData: keepPreviousData,
  });
}

export function useCreateAnalystNote(
  targetKind: CollaborationTargetKind,
  targetId: string,
  confirmActorId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string): Promise<AnalystNoteDto> => {
      if (!confirmActorId) {
        throw new ApiClientError("Bound collaboration session required", 401, "UNAUTHENTICATED");
      }
      const input = { body, confirmActorId };
      return targetKind === "CASE"
        ? drugAnalystNotesClient.createCaseNote(targetId, input)
        : drugAnalystNotesClient.createPersonNote(targetId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-analyst-notes", targetKind, targetId] });
    },
  });
}

export function useUpdateAnalystNote(
  targetKind: CollaborationTargetKind,
  targetId: string,
  confirmActorId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; body: string }): Promise<AnalystNoteDto> => {
      if (!confirmActorId) {
        throw new ApiClientError("Bound collaboration session required", 401, "UNAUTHENTICATED");
      }
      return drugAnalystNotesClient.updateNote(noteId, { body, confirmActorId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-analyst-notes", targetKind, targetId] });
    },
  });
}
