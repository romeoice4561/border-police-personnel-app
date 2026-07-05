/**
 * GET /api/gallery/companies — company facets with counts, optionally scoped
 * to ?category and ?region. Drives the "Filter by Company" step.
 */

import type { NextRequest } from "next/server";
import { getGalleryContainer } from "@/lib/gallery/gallery_container";
import { handleGalleryCompanies } from "@/lib/gallery/gallery_api_handlers";
import { guarded } from "@/lib/api/api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { service } = await getGalleryContainer();
    return handleGalleryCompanies(service, request.nextUrl.searchParams);
  });
}
