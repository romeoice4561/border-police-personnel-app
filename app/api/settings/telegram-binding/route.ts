/**
 * Authenticated Telegram binding management (Phase 51.3).
 * GET status · POST create deep-link token · DELETE revoke
 */
import type { NextRequest } from "next/server";
import { resolveIntelligenceActor } from "@/lib/server/personnel_intelligence_api_auth";
import { loadTelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import {
  createBindingToken,
  getBindingPublicView,
  revokeBindingForAppUser,
  TelegramBindingError,
} from "@/lib/telegram_identity/binding_service";
import {
  allowAllTelegramRateLimiter,
  createInProcessTelegramRateLimiter,
  type TelegramRateLimiter,
} from "@/lib/telegram_identity/rate_limit";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

const tokenLimiter: TelegramRateLimiter =
  process.env.TELEGRAM_IDENTITY_STORE === "memory"
    ? allowAllTelegramRateLimiter
    : createInProcessTelegramRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest): Promise<Response> {
  const resolved = await resolveIntelligenceActor(request);
  if (!resolved.ok) return resolved.response;
  const view = await getBindingPublicView(resolved.actor.id);
  return json({ ok: true, binding: view });
}

export async function POST(request: NextRequest): Promise<Response> {
  const resolved = await resolveIntelligenceActor(request);
  if (!resolved.ok) return resolved.response;

  let body: { replaceExisting?: boolean } = {};
  try {
    body = (await request.json()) as { replaceExisting?: boolean };
  } catch {
    body = {};
  }

  const limit = await tokenLimiter.check(`bind-token:${resolved.actor.id}`);
  if (!limit.allowed) {
    return json({ ok: false, error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  }

  const existing = await getBindingPublicView(resolved.actor.id);
  if (existing.status === "ACTIVE" && !body.replaceExisting) {
    return json(
      {
        ok: false,
        error: "ALREADY_BOUND",
        message: "บัญชีนี้เชื่อมต่อ Telegram อยู่แล้ว — ใช้ replaceExisting เพื่อเชื่อมต่อใหม่",
      },
      409
    );
  }

  if (existing.status === "ACTIVE" && body.replaceExisting) {
    try {
      await revokeBindingForAppUser({ appUserId: resolved.actor.id });
    } catch (error) {
      if (!(error instanceof TelegramBindingError)) throw error;
    }
  }

  const config = loadTelegramPersonnelSearchConfig();
  const token = await createBindingToken({
    appUserId: resolved.actor.id,
    botUsername: config.botUsername,
  });

  // Never return rawToken alone without deep link context; omit hash entirely.
  return json({
    ok: true,
    deepLink: token.deepLink,
    expiresAt: token.expiresAt,
    botUsername: config.botUsername,
  });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const resolved = await resolveIntelligenceActor(request);
  if (!resolved.ok) return resolved.response;

  try {
    await revokeBindingForAppUser({ appUserId: resolved.actor.id });
    return json({ ok: true });
  } catch (error) {
    if (error instanceof TelegramBindingError && error.code === "NOT_FOUND") {
      return json({ ok: false, error: "NOT_FOUND", message: "ไม่พบการเชื่อมต่อที่ใช้งานอยู่" }, 404);
    }
    throw error;
  }
}
