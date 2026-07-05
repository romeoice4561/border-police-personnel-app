/**
 * GET /api/gallery/categories — Gallery category facets with counts (reserved
 * PROFILE excluded). Drives the "Filter by Category" step.
 */

import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import { handleGalleryCategories } from "@/lib/gallery/gallery_api_handlers";
import { guarded } from "@/lib/api/api_handlers";

export async function GET(): Promise<Response> {
  return guarded(async () => {
    const { service } = await getGalleryContainer();
    return handleGalleryCategories(service);
  });
}
