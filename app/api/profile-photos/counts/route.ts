/**
 * GET /api/profile-photos/counts — per-classification counts for the legacy
 * cleanup tool's filter chips (Phase 24B-2).
 */

import { guarded } from "@/lib/api/api_handlers";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handleClassificationCounts } from "@/lib/profile_photo/profile_photo_api_handlers";

export async function GET(): Promise<Response> {
  return guarded(async () => {
    const { service } = await getProfilePhotoContainer();
    return handleClassificationCounts(service);
  });
}
