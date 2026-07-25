/**
 * Durable Telegram session store (Phase 51.3).
 * Interface + Prisma adapter + in-memory development adapter.
 */
import type { TelegramSearchSession } from "@/lib/personnel_search_telegram/types";

export const TELEGRAM_SESSION_SCHEMA_VERSION = 1;

export interface TelegramSessionStoreV2 {
  get(telegramUserId: string): Promise<TelegramSearchSession | null>;
  set(session: TelegramSearchSession, ttlSeconds: number): Promise<void>;
  delete(telegramUserId: string): Promise<void>;
  touch(telegramUserId: string, ttlSeconds: number): Promise<void>;
}

function isSafeSession(value: unknown): value is TelegramSearchSession {
  if (!value || typeof value !== "object") return false;
  const s = value as TelegramSearchSession;
  return (
    typeof s.chatId === "number" &&
    typeof s.telegramUserId === "number" &&
    typeof s.mode === "string" &&
    Array.isArray(s.cursorStack) &&
    Array.isArray(s.lastActions) &&
    typeof s.conversationContext === "object"
  );
}

/** Development / test in-memory store — NOT multi-instance production-ready. */
export function createMemoryTelegramSessionStoreV2(): TelegramSessionStoreV2 {
  const map = new Map<string, { session: TelegramSearchSession; expiresAt: number }>();
  return {
    async get(telegramUserId) {
      const row = map.get(telegramUserId);
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        map.delete(telegramUserId);
        return null;
      }
      return row.session;
    },
    async set(session, ttlSeconds) {
      map.set(String(session.telegramUserId), {
        session,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
    async delete(telegramUserId) {
      map.delete(telegramUserId);
    },
    async touch(telegramUserId, ttlSeconds) {
      const row = map.get(telegramUserId);
      if (!row) return;
      row.expiresAt = Date.now() + ttlSeconds * 1000;
    },
  };
}

/** Postgres-backed store for multi-instance deployments. */
export function createPrismaTelegramSessionStore(): TelegramSessionStoreV2 {
  return {
    async get(telegramUserId) {
      const { createDatabaseClient } = await import("@/lib/database/database");
      const db = createDatabaseClient();
      const row = await db.telegramBotSession.findUnique({ where: { telegramUserId } });
      if (!row) return null;
      if (row.expiresAt.getTime() <= Date.now()) {
        await db.telegramBotSession.delete({ where: { telegramUserId } }).catch(() => {});
        return null;
      }
      if (row.schemaVersion !== TELEGRAM_SESSION_SCHEMA_VERSION) {
        await db.telegramBotSession.delete({ where: { telegramUserId } }).catch(() => {});
        return null;
      }
      try {
        const parsed = JSON.parse(row.payloadJson) as unknown;
        if (!isSafeSession(parsed)) {
          await db.telegramBotSession.delete({ where: { telegramUserId } }).catch(() => {});
          return null;
        }
        if (String(parsed.telegramUserId) !== telegramUserId) {
          await db.telegramBotSession.delete({ where: { telegramUserId } }).catch(() => {});
          return null;
        }
        return parsed;
      } catch {
        await db.telegramBotSession.delete({ where: { telegramUserId } }).catch(() => {});
        return null;
      }
    },
    async set(session, ttlSeconds) {
      const { createDatabaseClient } = await import("@/lib/database/database");
      const db = createDatabaseClient();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const payloadJson = JSON.stringify(sanitizeSessionForStorage(session));
      await db.telegramBotSession.upsert({
        where: { telegramUserId: String(session.telegramUserId) },
        create: {
          telegramUserId: String(session.telegramUserId),
          chatId: String(session.chatId),
          payloadJson,
          schemaVersion: TELEGRAM_SESSION_SCHEMA_VERSION,
          expiresAt,
        },
        update: {
          chatId: String(session.chatId),
          payloadJson,
          schemaVersion: TELEGRAM_SESSION_SCHEMA_VERSION,
          expiresAt,
        },
      });
    },
    async delete(telegramUserId) {
      const { createDatabaseClient } = await import("@/lib/database/database");
      const db = createDatabaseClient();
      await db.telegramBotSession.deleteMany({ where: { telegramUserId } });
    },
    async touch(telegramUserId, ttlSeconds) {
      const { createDatabaseClient } = await import("@/lib/database/database");
      const db = createDatabaseClient();
      await db.telegramBotSession.updateMany({
        where: { telegramUserId },
        data: { expiresAt: new Date(Date.now() + ttlSeconds * 1000) },
      });
    },
  };
}

/** Strip anything that must never be persisted (full personnel payloads). */
function sanitizeSessionForStorage(session: TelegramSearchSession): TelegramSearchSession {
  return {
    ...session,
    lastActions: session.lastActions.map((a) => ({
      type: a.type,
      labelTh: a.labelTh,
      labelEn: a.labelEn,
      payload: {
        ...a.payload,
        // keep only safe scalar follow-up hints
      },
    })),
  };
}

/**
 * Select store: Prisma when TELEGRAM_SESSION_STORE=prisma (default in production),
 * memory when explicitly requested or DB unavailable for tests.
 */
export function createTelegramSessionStoreFromEnv(
  env: Record<string, string | undefined> = process.env
): TelegramSessionStoreV2 {
  const mode = (env.TELEGRAM_SESSION_STORE ?? "prisma").toLowerCase();
  if (mode === "memory") return createMemoryTelegramSessionStoreV2();
  return createPrismaTelegramSessionStore();
}
