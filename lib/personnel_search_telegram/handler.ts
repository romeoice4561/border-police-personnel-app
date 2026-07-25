/**
 * Webhook request handler for Telegram Commander Experience (Phase 51.2).
 */

import type { NextRequest } from "next/server";
import { createPersonnelSearchApiClient } from "@/lib/personnel_search_telegram/api_client";
import {
  loadTelegramPersonnelSearchConfig,
  type TelegramPersonnelSearchConfig,
} from "@/lib/personnel_search_telegram/config";
import { dispatchTelegramUpdate, type TelegramDispatcherDeps } from "@/lib/personnel_search_telegram/dispatcher";
import { getDefaultTelegramSessionStore } from "@/lib/personnel_search_telegram/session";
import {
  createNoopCallbackAnswerer,
  createNoopTelegramSender,
  createTelegramBotSender,
  createTelegramCallbackAnswerer,
} from "@/lib/personnel_search_telegram/telegram_api";
import type { TelegramUpdate } from "@/lib/personnel_search_telegram/types";

export interface TelegramWebhookHandlerDeps {
  config?: TelegramPersonnelSearchConfig;
  dispatcherDeps?: Partial<TelegramDispatcherDeps>;
}

function unauthorized(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 401 });
}

function badRequest(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

/**
 * Handle POST /api/telegram/webhook
 */
export async function handleTelegramWebhook(
  request: NextRequest,
  deps: TelegramWebhookHandlerDeps = {}
): Promise<Response> {
  const config = deps.config ?? loadTelegramPersonnelSearchConfig();

  if (config.webhookSecret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== config.webhookSecret) {
      return unauthorized("Invalid webhook secret");
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return badRequest("Malformed JSON");
  }

  if (typeof update?.update_id !== "number") {
    return badRequest("Invalid Telegram update");
  }

  const send =
    deps.dispatcherDeps?.send ??
    (config.botToken ? createTelegramBotSender(config.botToken) : createNoopTelegramSender());
  const answerCallback =
    deps.dispatcherDeps?.answerCallback ??
    (config.botToken ? createTelegramCallbackAnswerer(config.botToken) : createNoopCallbackAnswerer());

  const dispatcherDeps: TelegramDispatcherDeps = {
    config,
    sessions: deps.dispatcherDeps?.sessions ?? getDefaultTelegramSessionStore(),
    apiClient: deps.dispatcherDeps?.apiClient ?? createPersonnelSearchApiClient(),
    send,
    answerCallback,
  };

  try {
    await dispatchTelegramUpdate(update, dispatcherDeps);
  } catch (error) {
    console.error(
      "[telegram-webhook]",
      error instanceof Error ? error.message : "dispatch failed"
    );
    // Always 200 to Telegram so it does not retry forever on app errors.
  }

  return Response.json({ ok: true });
}
