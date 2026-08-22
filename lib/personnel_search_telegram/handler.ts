/**
 * Webhook request handler for Telegram Commander Experience (Phase 51.2 / 51.3).
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  createConsoleTelegramIdentityAuditSink,
  recordTelegramIdentityAudit,
  type TelegramIdentityAuditSink,
} from "@/lib/telegram_identity/audit";
import {
  createTelegramSessionStoreFromEnv,
  type TelegramSessionStoreV2,
} from "@/lib/telegram_identity/session_store";
import {
  createUpdateDedupeStoreFromEnv,
  normalizeUpdateId,
  type TelegramUpdateDedupeStore,
} from "@/lib/telegram_identity/update_dedupe";
import { createBoundPersonnelSearchApiClient } from "@/lib/personnel_search_telegram/api_client";
import {
  loadTelegramPersonnelSearchConfig,
  type TelegramPersonnelSearchConfig,
} from "@/lib/personnel_search_telegram/config";
import { dispatchTelegramUpdate, type TelegramDispatcherDeps } from "@/lib/personnel_search_telegram/dispatcher";
import {
  createNoopCallbackAnswerer,
  createNoopTelegramSender,
  createTelegramBotSender,
  createTelegramCallbackAnswerer,
} from "@/lib/personnel_search_telegram/telegram_api";
import type { TelegramUpdate } from "@/lib/personnel_search_telegram/types";
import { createInProcessTelegramRateLimiter, type TelegramRateLimiter } from "@/lib/telegram_identity/rate_limit";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

/**
 * Phase DI-4, Section 26/27 — per-process Drug-search rate limiter. In
 * -process only (documented limitation of createInProcessTelegramRateLimiter
 * itself — not multi-instance-safe), reused across requests within one
 * server process the same way createTelegramSessionStoreFromEnv's memory
 * mode already is; still meaningfully raises the bar against automated
 * enumeration compared to no limiter at all (the previous state).
 */
let cachedDrugRateLimiter: TelegramRateLimiter | undefined;
function getDrugRateLimiter(config: TelegramPersonnelSearchConfig): TelegramRateLimiter {
  if (!cachedDrugRateLimiter) {
    cachedDrugRateLimiter = createInProcessTelegramRateLimiter({
      max: config.drugSearchRateLimitMax,
      windowMs: config.drugSearchRateLimitWindowMs,
    });
  }
  return cachedDrugRateLimiter;
}

const telegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: z
      .object({
        message_id: z.number(),
        date: z.number(),
        chat: z.object({ id: z.number(), type: z.string() }).passthrough(),
        from: z.object({ id: z.number() }).passthrough().optional(),
        text: z.string().max(4096).optional(),
      })
      .passthrough()
      .optional(),
    callback_query: z
      .object({
        id: z.string(),
        from: z.object({ id: z.number() }).passthrough(),
        message: z
          .object({
            message_id: z.number(),
            date: z.number(),
            chat: z.object({ id: z.number(), type: z.string() }).passthrough(),
          })
          .passthrough()
          .optional(),
        data: z.string().max(64).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export interface TelegramWebhookHandlerDeps {
  config?: TelegramPersonnelSearchConfig;
  dispatcherDeps?: Partial<TelegramDispatcherDeps>;
  sessions?: TelegramSessionStoreV2;
  dedupe?: TelegramUpdateDedupeStore;
  auditSink?: TelegramIdentityAuditSink;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function redactSecrets(text: string, botToken: string | null): string {
  if (!botToken) return text;
  return text.split(botToken).join("[REDACTED_BOT_TOKEN]");
}

/**
 * Handle POST /api/telegram/webhook
 */
export async function handleTelegramWebhook(
  request: NextRequest,
  deps: TelegramWebhookHandlerDeps = {}
): Promise<Response> {
  const config = deps.config ?? loadTelegramPersonnelSearchConfig();
  const auditSink = deps.auditSink ?? createConsoleTelegramIdentityAuditSink();

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (config.requireWebhookSecret || config.webhookSecret) {
    if (!config.webhookSecret || secretHeader !== config.webhookSecret) {
      await recordTelegramIdentityAudit(auditSink, { type: "invalid_webhook_secret" });
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > config.maxBodyBytes) {
    return json({ ok: false, error: "Payload too large" }, 413);
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return json({ ok: false, error: "Bad request" }, 400);
  }
  if (rawText.length > config.maxBodyBytes) {
    return json({ ok: false, error: "Payload too large" }, 413);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText) as unknown;
  } catch {
    return json({ ok: false, error: "Malformed JSON" }, 400);
  }

  const validated = telegramUpdateSchema.safeParse(parsedJson);
  if (!validated.success) {
    return json({ ok: false, error: "Invalid update" }, 400);
  }

  const update = validated.data as TelegramUpdate;

  // Unsupported update shapes (no message text / callback) — ack safely.
  if (!update.message?.text && !update.callback_query) {
    return json({ ok: true }, 200);
  }

  const dedupe = deps.dedupe ?? createUpdateDedupeStoreFromEnv();
  const updateKey = normalizeUpdateId(update.update_id);
  const isDuplicate = await dedupe.claim(updateKey, config.updateDedupeTtlSeconds);
  if (isDuplicate) {
    await recordTelegramIdentityAudit(auditSink, {
      type: "duplicate_update_ignored",
      updateId: updateKey,
    });
    return json({ ok: true }, 200);
  }

  const send =
    deps.dispatcherDeps?.send ??
    (config.botToken ? createTelegramBotSender(config.botToken) : createNoopTelegramSender());
  const answerCallback =
    deps.dispatcherDeps?.answerCallback ??
    (config.botToken ? createTelegramCallbackAnswerer(config.botToken) : createNoopCallbackAnswerer());

  const sessions =
    deps.sessions ??
    deps.dispatcherDeps?.sessions ??
    createTelegramSessionStoreFromEnv({
      TELEGRAM_SESSION_STORE: config.sessionStoreMode,
    });

  const dispatcherDeps: TelegramDispatcherDeps = {
    config,
    sessions,
    apiClient: deps.dispatcherDeps?.apiClient ?? createBoundPersonnelSearchApiClient(),
    send,
    answerCallback,
    resolvePrincipal: deps.dispatcherDeps?.resolvePrincipal,
    completeBinding: deps.dispatcherDeps?.completeBinding,
    createHandoff: deps.dispatcherDeps?.createHandoff,
    auditSink: deps.dispatcherDeps?.auditSink ?? auditSink,
    drugRateLimiter: deps.dispatcherDeps?.drugRateLimiter ?? getDrugRateLimiter(config),
  };

  try {
    await dispatchTelegramUpdate(update, dispatcherDeps);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "dispatch failed";
    console.error("[telegram-webhook]", redactSecrets(msg, config.botToken));
    // Always 200 to Telegram so it does not retry forever on app errors.
  }

  return json({ ok: true }, 200);
}
