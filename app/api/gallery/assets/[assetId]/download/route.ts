/**
 * GET /api/gallery/assets/{assetId}/download
 *
 * Proxies the Gallery asset image back to the client with
 * Content-Disposition: attachment so the browser downloads it immediately.
 * Required because Drive thumbnail URLs are cross-origin (CORS blocks
 * fetch→blob; browsers ignore the HTML download attribute).
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import { handleDownloadGalleryAsset } from "@/lib/gallery/gallery_api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { assetId } = await params;
    const { service } = await getGalleryContainer();
    return handleDownloadGalleryAsset(service, decodeURIComponent(assetId));
  });
}
