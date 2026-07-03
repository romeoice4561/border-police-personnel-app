/**
 * GET /api/officers/{id} — complete officer profile (identity, timeline,
 * phones, quality/knowledge scores).
 *
 * `params` is a Promise in this Next.js version and must be awaited.
 */

import type { NextRequest } from "next/server";
import { getApiContainer } from "@/lib/api/api_container";
import { handleOfficerById, guarded } from "@/lib/api/api_handlers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    return handleOfficerById(getApiContainer, decodeURIComponent(id));
  });
}
