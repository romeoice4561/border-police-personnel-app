/**
 * GET /api/gallery/assets/{assetId} — one Gallery asset by id.
 *
 * `params` is a Promise in this Next.js version and must be awaited. Returns
 * 404 when the asset is absent OR is a reserved PROFILE asset (AssetService
 * never returns PROFILE via the Gallery).
 */

import type { NextRequest } from "next/server";
import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import { handleGalleryAssetById } from "@/lib/gallery/gallery_api_handlers";
import { guarded } from "@/lib/api/api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { assetId } = await params;
    const { service } = await getGalleryContainer();
    return handleGalleryAssetById(service, decodeURIComponent(assetId));
  });
}
