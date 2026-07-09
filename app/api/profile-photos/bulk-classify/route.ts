/**
 * POST /api/profile-photos/bulk-classify — bulk verify/reject across many
 * ProfilePhoto rows at once (Phase 24B-2 legacy cleanup tool).
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handleBulkClassifyProfilePhotos } from "@/lib/profile_photo/profile_photo_api_handlers";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { service } = await getProfilePhotoContainer();
    return handleBulkClassifyProfilePhotos(service, request);
  });
}
