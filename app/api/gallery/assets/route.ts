/**
 * GET /api/gallery/assets — filtered, sorted, paginated Gallery assets +
 * facet counts. Thin route adapter: builds the Gallery container (real Prisma
 * client) and delegates to the framework-agnostic handler. No filtering logic
 * here; PROFILE assets are excluded by AssetService.
 */

import type { NextRequest } from "next/server";
import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import { handleGalleryAssets } from "@/lib/gallery/gallery_api_handlers";
import { guarded } from "@/lib/api/api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { service } = await getGalleryContainer();
    return handleGalleryAssets(service, request.nextUrl.searchParams);
  });
}
