/**
 * POST /api/officers/{id}/portrait/history/{photoId} — "Set as Current"
 * (Phase 24B-2): makes an existing ProfilePhoto the officer's current
 * portrait WITHOUT uploading a new file. Never deletes anything; every other
 * photo for this officer is demoted (isProfile=false).
 *
 * Thin adapter delegating to the framework-agnostic handler. `params` is a
 * Promise in this Next.js version.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handleSetCurrentPortrait } from "@/lib/portrait/portrait_api_handlers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id, photoId } = await params;
    const { service } = await getProfilePhotoContainer();
    return handleSetCurrentPortrait(service, decodeURIComponent(id), photoId);
  });
}
