/**
 * Officer Profile Workspace React Query hooks (Phase 23A).
 *
 * The mutation hook the workspace's single "Save" action calls — batches
 * profile/timeline/education/training into one PATCH request. On success,
 * invalidates the officer detail Server Component's data by triggering a
 * router refresh (the page itself is a Server Component fetching via
 * getOfficerProfile, not a React Query-driven client fetch — see
 * app/officers/[id]/page.tsx), so this hook's job is only the mutation
 * itself; the caller decides how to refresh.
 *
 * "use client" — only consumed by client components.
 */
"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, type OfficerProfileSaveRequest, type OfficerProfileSaveResponse } from "@/lib/ui/api_client";

export function useSaveOfficerProfile() {
  return useMutation<OfficerProfileSaveResponse, Error, { officerId: string; body: OfficerProfileSaveRequest }>({
    mutationFn: ({ officerId, body }) => apiClient.saveOfficerProfile(officerId, body),
  });
}
