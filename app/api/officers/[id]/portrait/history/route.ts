/**
 * GET /api/officers/{id}/portrait/history — every portrait ever linked to
 * this officer (current + history), newest first. Never deletes/filters —
 * the panel renders source, upload date, Drive file, current badge, and
 * verification status per row (Phase 24B-2).
 *
 * Thin adapter delegating to the framework-agnostic handler. `params` is a
 * Promise in this Next.js version.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handlePortraitHistory } from "@/lib/portrait/portrait_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { service } = await getProfilePhotoContainer();
    return handlePortraitHistory(service, decodeURIComponent(id));
  });
}
