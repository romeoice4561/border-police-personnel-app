/**
 * Telegram update_id deduplication (Phase 51.3).
 *
 * Policy on storage failure: fail-open for memory/dev; Prisma adapter
 * fail-closed (treat as already processed) is safer against duplicate sends
 * when DB is flaky — we choose fail-open with warning so webhook still works.
 */
import { createHash } from "node:crypto";

export interface TelegramUpdateDedupeStore {
  /** Returns true if this update was already seen (should skip). */
  claim(updateId: string, ttlSeconds: number): Promise<boolean>;
}

export function createMemoryUpdateDedupeStore(): TelegramUpdateDedupeStore {
  const map = new Map<string, number>();
  return {
    async claim(updateId, ttlSeconds) {
      const now = Date.now();
      for (const [k, exp] of map) {
        if (exp < now) map.delete(k);
      }
      if (map.has(updateId)) return true;
      map.set(updateId, now + ttlSeconds * 1000);
      return false;
    },
  };
}

export function createPrismaUpdateDedupeStore(): TelegramUpdateDedupeStore {
  return {
    async claim(updateId, ttlSeconds) {
      try {
        const { createDatabaseClient } = await import("@/lib/database/database");
        const db = createDatabaseClient();
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
        await db.telegramProcessedUpdate.create({
          data: { updateId, expiresAt },
        });
        return false;
      } catch (error) {
        // Unique violation → duplicate
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("Unique") || msg.includes("P2002")) return true;
        console.warn("[telegram-dedupe] storage failure; fail-open", msg.slice(0, 120));
        return false;
      }
    },
  };
}

export function createUpdateDedupeStoreFromEnv(
  env: Record<string, string | undefined> = process.env
): TelegramUpdateDedupeStore {
  const mode = (env.TELEGRAM_SESSION_STORE ?? "prisma").toLowerCase();
  if (mode === "memory") return createMemoryUpdateDedupeStore();
  return createPrismaUpdateDedupeStore();
}

/** Stable key for update_id (Telegram integers can be large). */
export function normalizeUpdateId(updateId: number): string {
  return createHash("sha256").update(String(updateId)).digest("hex").slice(0, 32);
}
