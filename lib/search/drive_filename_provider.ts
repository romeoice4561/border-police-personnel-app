/**
 * Drive filename search provider (Phase 26B Part B).
 *
 * Wraps the EXISTING ProfilePhotoService.list({ search }) — which already
 * free-text matches filename/folderPath/matchedOfficerId — and extracts the
 * distinct officerIds among the matches. No new query logic, no
 * denormalization: Officer <-> Drive filename stays joined through the
 * existing matchedOfficerId link, exactly as it always has been.
 */

import type { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import type { SearchProvider } from "@/lib/search/global_search_types";

const MAX_PHOTO_MATCHES = 200;

export class DriveFilenameSearchProvider implements SearchProvider {
  readonly name = "drive_filename";

  constructor(private readonly profilePhotoService: ProfilePhotoService) {}

  async findMatchingOfficerIds(query: string): Promise<Set<string>> {
    const q = query.trim();
    if (!q) return new Set();

    const result = await this.profilePhotoService.list({ search: q, page: 1, pageSize: MAX_PHOTO_MATCHES });
    const ids = new Set<string>();
    for (const photo of result.data) {
      if (photo.matchedOfficerId) ids.add(photo.matchedOfficerId);
    }
    return ids;
  }
}
