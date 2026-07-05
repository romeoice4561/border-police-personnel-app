/**
 * GET /api/gallery/regions — region facets with counts, optionally scoped to
 * ?category. Drives the "Filter by Region" step.
 */

import type { NextRequest } from "next/server";
import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import { handleGalleryRegions } from "@/lib/gallery/gallery_api_handlers";
import { guarded } from "@/lib/api/api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { service } = await getGalleryContainer();
    return handleGalleryRegions(service, request.nextUrl.searchParams);
  });
}
