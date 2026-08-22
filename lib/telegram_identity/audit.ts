/**
 * Safe structured audit for Telegram identity events (Phase 51.3).
 * Never logs raw tokens, bot tokens, or search text.
 */

export type TelegramIdentityAuditEvent =
  | { type: "binding_token_created"; appUserId: string; expiresAt: string }
  | { type: "binding_completed"; appUserId: string; telegramUserId: string }
  | { type: "binding_rejected"; reason: string; telegramUserId?: string }
  | { type: "binding_revoked"; appUserId: string; telegramUserId: string }
  | { type: "search_requested"; appUserId: string; telegramUserId: string }
  | { type: "drug_search_requested"; appUserId: string; telegramUserId: string }
  | { type: "drug_permission_denied"; appUserId: string; telegramUserId: string }
  | { type: "unbound_rejected"; telegramUserId: string }
  | { type: "invalid_webhook_secret" }
  | { type: "duplicate_update_ignored"; updateId: string }
  | { type: "callback_rejected"; telegramUserId: string; reason: string }
  | { type: "session_expired"; telegramUserId: string }
  | { type: "handoff_created"; appUserId: string; destination: string }
  | { type: "handoff_consumed"; appUserId: string; destination: string };

export interface TelegramIdentityAuditSink {
  record(event: TelegramIdentityAuditEvent): void | Promise<void>;
}

export const noopTelegramIdentityAuditSink: TelegramIdentityAuditSink = {
  record() {},
};

export function createConsoleTelegramIdentityAuditSink(): TelegramIdentityAuditSink {
  return {
    record(event) {
      if (process.env.NODE_ENV === "production") return;
      console.info("[telegram-identity-audit]", event);
    },
  };
}

export async function recordTelegramIdentityAudit(
  sink: TelegramIdentityAuditSink | undefined,
  event: TelegramIdentityAuditEvent
): Promise<void> {
  try {
    await (sink ?? noopTelegramIdentityAuditSink).record(event);
  } catch {
    /* never fail callers */
  }
}
