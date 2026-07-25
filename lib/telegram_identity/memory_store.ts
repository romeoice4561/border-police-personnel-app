/**
 * In-memory Telegram identity store for tests / local bootstrap (Phase 51.3).
 * Not multi-instance production-ready.
 */

export type MemoryBindingStatus = "PENDING_VERIFICATION" | "ACTIVE" | "REVOKED" | "DISABLED";

export interface MemoryBindingRow {
  id: string;
  telegramUserId: string;
  appUserId: string;
  status: MemoryBindingStatus;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  disabledAt: Date | null;
}

export interface MemoryTokenRow {
  id: string;
  tokenHash: string;
  appUserId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface MemoryHandoffRow {
  id: string;
  tokenHash: string;
  appUserId: string;
  destination: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface MemoryTelegramIdentityStore {
  bindings: Map<string, MemoryBindingRow>;
  tokens: Map<string, MemoryTokenRow>;
  handoffs: Map<string, MemoryHandoffRow>;
  sessions: Map<string, { payloadJson: string; expiresAt: Date; schemaVersion: number; chatId: string }>;
  updates: Map<string, Date>;
}

let memoryStore: MemoryTelegramIdentityStore | null = null;

export function getMemoryTelegramIdentityStore(): MemoryTelegramIdentityStore {
  if (!memoryStore) {
    memoryStore = {
      bindings: new Map(),
      tokens: new Map(),
      handoffs: new Map(),
      sessions: new Map(),
      updates: new Map(),
    };
  }
  return memoryStore;
}

export function resetMemoryTelegramIdentityStore(): void {
  memoryStore = {
    bindings: new Map(),
    tokens: new Map(),
    handoffs: new Map(),
    sessions: new Map(),
    updates: new Map(),
  };
}

export function useMemoryTelegramIdentityStore(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (env.TELEGRAM_IDENTITY_STORE ?? "").toLowerCase() === "memory";
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}
