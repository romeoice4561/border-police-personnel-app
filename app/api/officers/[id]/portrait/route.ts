/**
 * POST   /api/officers/{id}/portrait — upload/replace the officer's portrait
 *        (multipart/form-data, field "file"). Stores bytes in Supabase Storage,
 *        persists a ProfilePhoto row, and makes it the current portrait.
 * GET    /api/officers/{id}/portrait — the officer's current portrait metadata.
 * DELETE /api/officers/{id}/portrait — remove the current portrait (soft;
 *        old portraits are preserved as history).
 *
 * Thin adapter: builds the portrait container and delegates to the
 * framework-agnostic handlers. Google Drive is never written — uploaded bytes
 * live in Supabase Storage. `params` is a Promise in this Next.js version.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";
import { getPortraitContainer } from "@/lib/portrait/portrait_container";
import {
  handleGetCurrentPortrait,
  handlePortraitRemove,
  handlePortraitUpload,
} from "@/lib/portrait/portrait_api_handlers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const result = await getPortraitContainer();
    if (!result.configured) return serviceUnavailable(result.reason);
    return handlePortraitUpload(result.container.service, decodeURIComponent(id), request);
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const result = await getPortraitContainer();
    if (!result.configured) return serviceUnavailable(result.reason);
    return handleGetCurrentPortrait(result.container.service, decodeURIComponent(id));
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const result = await getPortraitContainer();
    if (!result.configured) return serviceUnavailable(result.reason);
    return handlePortraitRemove(result.container.service, decodeURIComponent(id));
  });
}
