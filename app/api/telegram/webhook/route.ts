/**
 * POST /api/telegram/webhook — Telegram Commander Experience (Phase 51.2).
 *
 * Presentation adapter only. Search goes through Personnel Search API.
 */
import type { NextRequest } from "next/server";
import { handleTelegramWebhook } from "@/lib/personnel_search_telegram/handler";

export async function POST(request: NextRequest): Promise<Response> {
  return handleTelegramWebhook(request);
}

export async function GET(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: "Telegram webhook accepts POST updates only",
    },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}
