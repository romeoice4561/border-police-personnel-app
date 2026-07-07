/**
 * GET   /api/officers/{id} — complete officer profile (identity, timeline,
 *       phones, education, training, quality/knowledge scores).
 * PATCH /api/officers/{id} — Officer Profile Workspace batched save
 *       (Phase 23A): profile/timeline/education/training, all optional,
 *       saved atomically in one transaction.
 *
 * `params` is a Promise in this Next.js version and must be awaited.
 */

import type { NextRequest } from "next/server";
import { getApiContainer } from "@/lib/api/api_container";
import { handleOfficerById, guarded } from "@/lib/api/api_handlers";
import { getOfficerProfileContainer } from "@/lib/officer_profile/officer_profile_container";
import { handleOfficerProfileSave } from "@/lib/officer_profile/officer_profile_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    return handleOfficerById(getApiContainer, decodeURIComponent(id));
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { service } = await getOfficerProfileContainer();
    return handleOfficerProfileSave(service, decodeURIComponent(id), request);
  });
}
