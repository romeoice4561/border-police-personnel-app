/**
 * GET /api/profile-photos — paginated, filtered ProfilePhoto list for the
 * Phase 24B-2 legacy cleanup admin tool (filter by classification/matchStatus/
 * region/company/battalion, search by officer or Drive file id).
 *
 * Thin adapter delegating to the framework-agnostic handler.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handleListProfilePhotos } from "@/lib/profile_photo/profile_photo_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { service } = await getProfilePhotoContainer();
    return handleListProfilePhotos(service, new URL(request.url));
  });
}
