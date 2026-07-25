/**
 * POST /api/personnel-search — Secure Personnel Search API (Phase 51.1).
 *
 * Authenticated + capability-checked. Read-only. No Telegram presentation.
 */
import type { NextRequest } from "next/server";
import { handlePersonnelSearchRequest } from "@/lib/personnel_search_api/handler";

export async function POST(request: NextRequest): Promise<Response> {
  return handlePersonnelSearchRequest(request);
}

export async function GET(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      requestId: "method-not-allowed",
      error: { code: "INVALID_REQUEST", message: "Use POST for personnel search" },
    },
    { status: 405, headers: { "Cache-Control": "no-store", Allow: "POST" } }
  );
}
