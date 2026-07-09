/**
 * POST /api/profile-photos/{id}/classify — a Gallery reviewer marks what one
 * photo's image actually shows (REAL_PERSON / PROFILE_CARD / ORGANIZATION /
 * MAP / DOCUMENT / UNKNOWN). Phase 24B-2. `params` is a Promise in this
 * Next.js version.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handleClassifyProfilePhoto } from "@/lib/profile_photo/profile_photo_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const { service } = await getProfilePhotoContainer();
    return handleClassifyProfilePhoto(service, id, request);
  });
}
