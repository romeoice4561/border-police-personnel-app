/**
 * Telegram ↔ AuthUser binding lifecycle (Phase 51.3).
 */
import { generateOpaqueToken, hashToken } from "@/lib/telegram_identity/crypto";
import {
  createConsoleTelegramIdentityAuditSink,
  recordTelegramIdentityAudit,
  type TelegramIdentityAuditSink,
} from "@/lib/telegram_identity/audit";
import {
  getMemoryTelegramIdentityStore,
  newId,
  useMemoryTelegramIdentityStore,
  type MemoryBindingRow,
} from "@/lib/telegram_identity/memory_store";
import type { BindingTokenCreateResult, TelegramBindingPublicView } from "@/lib/telegram_identity/types";

const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class TelegramBindingError extends Error {
  constructor(
    readonly code:
      | "TOKEN_INVALID"
      | "TOKEN_EXPIRED"
      | "TOKEN_USED"
      | "CONFLICT_TELEGRAM"
      | "CONFLICT_APP_USER"
      | "NOT_FOUND"
      | "NOT_ACTIVE",
    message: string
  ) {
    super(message);
    this.name = "TelegramBindingError";
  }
}

function maskTelegramId(id: string): string {
  if (id.length <= 4) return "***";
  return `${id.slice(0, 2)}…${id.slice(-2)}`;
}

function toPublicView(row: MemoryBindingRow | null): TelegramBindingPublicView {
  if (!row || row.status === "REVOKED") {
    return {
      status: "UNBOUND",
      telegramUsername: null,
      telegramFirstName: null,
      verifiedAt: null,
      lastUsedAt: null,
      telegramUserIdMasked: null,
    };
  }
  return {
    status: row.status,
    telegramUsername: row.telegramUsername,
    telegramFirstName: row.telegramFirstName,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    telegramUserIdMasked: maskTelegramId(row.telegramUserId),
  };
}

export async function getBindingPublicView(appUserId: string): Promise<TelegramBindingPublicView> {
  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    const rows = [...store.bindings.values()]
      .filter((b) => b.appUserId === appUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return toPublicView(rows[0] ?? null);
  }

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();
  const row = await db.telegramIdentityBinding.findFirst({
    where: { appUserId, status: { in: ["ACTIVE", "DISABLED", "REVOKED", "PENDING_VERIFICATION"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.status === "REVOKED") {
    return {
      status: "UNBOUND",
      telegramUsername: null,
      telegramFirstName: null,
      verifiedAt: null,
      lastUsedAt: null,
      telegramUserIdMasked: null,
    };
  }
  return {
    status: row.status,
    telegramUsername: row.telegramUsername,
    telegramFirstName: row.telegramFirstName,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    telegramUserIdMasked: maskTelegramId(row.telegramUserId),
  };
}

export async function createBindingToken(args: {
  appUserId: string;
  botUsername: string | null;
  ttlMs?: number;
  auditSink?: TelegramIdentityAuditSink;
}): Promise<BindingTokenCreateResult> {
  const rawToken = generateOpaqueToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + (args.ttlMs ?? DEFAULT_TOKEN_TTL_MS));

  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    store.tokens.set(tokenHash, {
      id: newId("tok"),
      tokenHash,
      appUserId: args.appUserId,
      expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    });
  } else {
    const { createDatabaseClient } = await import("@/lib/database/database");
    const db = createDatabaseClient();
    await db.telegramBindingToken.create({
      data: {
        tokenHash,
        appUserId: args.appUserId,
        expiresAt,
      },
    });
  }

  await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
    type: "binding_token_created",
    appUserId: args.appUserId,
    expiresAt: expiresAt.toISOString(),
  });

  const bot = (args.botUsername ?? "").replace(/^@/, "");
  const deepLink = bot
    ? `https://t.me/${bot}?start=${encodeURIComponent(rawToken)}`
    : `token:${rawToken}`;

  return { rawToken, expiresAt: expiresAt.toISOString(), deepLink };
}

export async function completeBindingFromStartToken(args: {
  rawToken: string;
  telegramUserId: string;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  /** When true, revoke prior ACTIVE binding for this app user before binding. */
  replaceExistingAppUserBinding?: boolean;
  auditSink?: TelegramIdentityAuditSink;
}): Promise<{ appUserId: string }> {
  const tokenHash = hashToken(args.rawToken);

  if (useMemoryTelegramIdentityStore()) {
    return completeBindingMemory(args, tokenHash);
  }

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();
  const token = await db.telegramBindingToken.findUnique({ where: { tokenHash } });

  if (!token) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "TOKEN_INVALID",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("TOKEN_INVALID", "Invalid binding token");
  }
  if (token.consumedAt) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "TOKEN_USED",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("TOKEN_USED", "Binding token already used");
  }
  if (token.expiresAt.getTime() < Date.now()) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "TOKEN_EXPIRED",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("TOKEN_EXPIRED", "Binding token expired");
  }

  const existingTg = await db.telegramIdentityBinding.findUnique({
    where: { telegramUserId: args.telegramUserId },
  });
  if (existingTg && existingTg.status === "ACTIVE" && existingTg.appUserId !== token.appUserId) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "CONFLICT_TELEGRAM",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("CONFLICT_TELEGRAM", "Telegram user already bound");
  }

  const existingApp = await db.telegramIdentityBinding.findFirst({
    where: { appUserId: token.appUserId, status: "ACTIVE" },
  });
  if (existingApp && existingApp.telegramUserId !== args.telegramUserId) {
    if (!args.replaceExistingAppUserBinding) {
      await recordTelegramIdentityAudit(args.auditSink, {
        type: "binding_rejected",
        reason: "CONFLICT_APP_USER",
        telegramUserId: args.telegramUserId,
      });
      throw new TelegramBindingError("CONFLICT_APP_USER", "App user already has an active Telegram binding");
    }
    await db.telegramIdentityBinding.update({
      where: { id: existingApp.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.telegramBindingToken.update({
      where: { id: token.id },
      data: { consumedAt: now },
    });

    if (existingTg) {
      await tx.telegramIdentityBinding.update({
        where: { id: existingTg.id },
        data: {
          appUserId: token.appUserId,
          status: "ACTIVE",
          verifiedAt: now,
          revokedAt: null,
          disabledAt: null,
          telegramUsername: args.telegramUsername ?? null,
          telegramFirstName: args.telegramFirstName ?? null,
          lastUsedAt: now,
        },
      });
    } else {
      await tx.telegramIdentityBinding.create({
        data: {
          telegramUserId: args.telegramUserId,
          appUserId: token.appUserId,
          status: "ACTIVE",
          verifiedAt: now,
          telegramUsername: args.telegramUsername ?? null,
          telegramFirstName: args.telegramFirstName ?? null,
          lastUsedAt: now,
        },
      });
    }
  });

  await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
    type: "binding_completed",
    appUserId: token.appUserId,
    telegramUserId: args.telegramUserId,
  });

  return { appUserId: token.appUserId };
}

async function completeBindingMemory(
  args: {
    rawToken: string;
    telegramUserId: string;
    telegramUsername?: string | null;
    telegramFirstName?: string | null;
    replaceExistingAppUserBinding?: boolean;
    auditSink?: TelegramIdentityAuditSink;
  },
  tokenHash: string
): Promise<{ appUserId: string }> {
  const store = getMemoryTelegramIdentityStore();
  const token = store.tokens.get(tokenHash);
  if (!token) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "TOKEN_INVALID",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("TOKEN_INVALID", "Invalid binding token");
  }
  if (token.consumedAt) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "TOKEN_USED",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("TOKEN_USED", "Binding token already used");
  }
  if (token.expiresAt.getTime() < Date.now()) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "TOKEN_EXPIRED",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("TOKEN_EXPIRED", "Binding token expired");
  }

  const existingTg = [...store.bindings.values()].find((b) => b.telegramUserId === args.telegramUserId);
  if (existingTg && existingTg.status === "ACTIVE" && existingTg.appUserId !== token.appUserId) {
    await recordTelegramIdentityAudit(args.auditSink, {
      type: "binding_rejected",
      reason: "CONFLICT_TELEGRAM",
      telegramUserId: args.telegramUserId,
    });
    throw new TelegramBindingError("CONFLICT_TELEGRAM", "Telegram user already bound");
  }

  const existingApp = [...store.bindings.values()].find(
    (b) => b.appUserId === token.appUserId && b.status === "ACTIVE"
  );
  if (existingApp && existingApp.telegramUserId !== args.telegramUserId) {
    if (!args.replaceExistingAppUserBinding) {
      await recordTelegramIdentityAudit(args.auditSink, {
        type: "binding_rejected",
        reason: "CONFLICT_APP_USER",
        telegramUserId: args.telegramUserId,
      });
      throw new TelegramBindingError("CONFLICT_APP_USER", "App user already has an active Telegram binding");
    }
    existingApp.status = "REVOKED";
    existingApp.revokedAt = new Date();
  }

  const now = new Date();
  token.consumedAt = now;

  if (existingTg) {
    existingTg.appUserId = token.appUserId;
    existingTg.status = "ACTIVE";
    existingTg.verifiedAt = now;
    existingTg.revokedAt = null;
    existingTg.disabledAt = null;
    existingTg.telegramUsername = args.telegramUsername ?? null;
    existingTg.telegramFirstName = args.telegramFirstName ?? null;
    existingTg.lastUsedAt = now;
  } else {
    const row: MemoryBindingRow = {
      id: newId("bind"),
      telegramUserId: args.telegramUserId,
      appUserId: token.appUserId,
      status: "ACTIVE",
      telegramUsername: args.telegramUsername ?? null,
      telegramFirstName: args.telegramFirstName ?? null,
      createdAt: now,
      verifiedAt: now,
      revokedAt: null,
      lastUsedAt: now,
      disabledAt: null,
    };
    store.bindings.set(row.id, row);
  }

  await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
    type: "binding_completed",
    appUserId: token.appUserId,
    telegramUserId: args.telegramUserId,
  });

  return { appUserId: token.appUserId };
}

export async function revokeBindingForAppUser(args: {
  appUserId: string;
  auditSink?: TelegramIdentityAuditSink;
}): Promise<{ telegramUserId: string | null }> {
  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    const active = [...store.bindings.values()].find(
      (b) => b.appUserId === args.appUserId && b.status === "ACTIVE"
    );
    if (!active) throw new TelegramBindingError("NOT_FOUND", "No active binding");
    active.status = "REVOKED";
    active.revokedAt = new Date();
    for (const token of store.tokens.values()) {
      if (token.appUserId === args.appUserId && !token.consumedAt) token.consumedAt = new Date();
    }
    store.sessions.delete(active.telegramUserId);
    for (const h of store.handoffs.values()) {
      if (h.appUserId === args.appUserId && !h.consumedAt) h.consumedAt = new Date();
    }
    await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
      type: "binding_revoked",
      appUserId: args.appUserId,
      telegramUserId: active.telegramUserId,
    });
    return { telegramUserId: active.telegramUserId };
  }

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();
  const active = await db.telegramIdentityBinding.findFirst({
    where: { appUserId: args.appUserId, status: "ACTIVE" },
  });
  if (!active) {
    throw new TelegramBindingError("NOT_FOUND", "No active binding");
  }

  await db.$transaction(async (tx) => {
    await tx.telegramIdentityBinding.update({
      where: { id: active.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await tx.telegramBindingToken.updateMany({
      where: { appUserId: args.appUserId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.telegramBotSession.deleteMany({ where: { telegramUserId: active.telegramUserId } });
    await tx.telegramWebHandoff.updateMany({
      where: { appUserId: args.appUserId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  });

  await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
    type: "binding_revoked",
    appUserId: args.appUserId,
    telegramUserId: active.telegramUserId,
  });

  return { telegramUserId: active.telegramUserId };
}

export async function touchBindingLastUsed(telegramUserId: string): Promise<void> {
  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    for (const b of store.bindings.values()) {
      if (b.telegramUserId === telegramUserId && b.status === "ACTIVE") {
        b.lastUsedAt = new Date();
      }
    }
    return;
  }
  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();
  await db.telegramIdentityBinding.updateMany({
    where: { telegramUserId, status: "ACTIVE" },
    data: { lastUsedAt: new Date() },
  });
}
