/**
 * Short-lived Web handoff tokens (Phase 51.3).
 * Establishes only the already-bound app principal at an allow-listed destination.
 */

import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { APPROVED_ACTION_PATH_PREFIXES } from "@/lib/personnel_search_api/contracts";
import {
  createConsoleTelegramIdentityAuditSink,
  recordTelegramIdentityAudit,
  type TelegramIdentityAuditSink,
} from "@/lib/telegram_identity/audit";
import { generateOpaqueToken, hashToken } from "@/lib/telegram_identity/crypto";
import {
  getMemoryTelegramIdentityStore,
  newId,
  useMemoryTelegramIdentityStore,
} from "@/lib/telegram_identity/memory_store";

const HANDOFF_TTL_MS = 5 * 60 * 1000;

export class TelegramHandoffError extends Error {
  constructor(
    readonly code: "INVALID" | "EXPIRED" | "USED" | "BAD_DESTINATION" | "USER_INACTIVE",
    message: string
  ) {
    super(message);
    this.name = "TelegramHandoffError";
  }
}

export function isApprovedHandoffDestination(destination: string): boolean {
  if (!destination.startsWith("/") || destination.startsWith("//") || destination.includes("://")) {
    return false;
  }
  return APPROVED_ACTION_PATH_PREFIXES.some(
    (prefix) => destination === prefix || destination.startsWith(prefix)
  );
}

export async function createWebHandoff(args: {
  appUserId: string;
  destination: string;
  auditSink?: TelegramIdentityAuditSink;
}): Promise<{ rawToken: string; expiresAt: string }> {
  if (!isApprovedHandoffDestination(args.destination)) {
    throw new TelegramHandoffError("BAD_DESTINATION", "Destination not allow-listed");
  }
  const rawToken = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);

  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    store.handoffs.set(hashToken(rawToken), {
      id: newId("hof"),
      tokenHash: hashToken(rawToken),
      appUserId: args.appUserId,
      destination: args.destination,
      expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    });
  } else {
    const { createDatabaseClient } = await import("@/lib/database/database");
    const db = createDatabaseClient();
    await db.telegramWebHandoff.create({
      data: {
        tokenHash: hashToken(rawToken),
        appUserId: args.appUserId,
        destination: args.destination,
        expiresAt,
      },
    });
  }

  await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
    type: "handoff_created",
    appUserId: args.appUserId,
    destination: args.destination,
  });
  return { rawToken, expiresAt: expiresAt.toISOString() };
}

export async function consumeWebHandoff(args: {
  rawToken: string;
  auditSink?: TelegramIdentityAuditSink;
}): Promise<{ appUserId: string; destination: string; userJson: string }> {
  const tokenHash = hashToken(args.rawToken);

  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    const row = store.handoffs.get(tokenHash);
    if (!row) throw new TelegramHandoffError("INVALID", "Invalid handoff");
    if (row.consumedAt) throw new TelegramHandoffError("USED", "Handoff already used");
    if (row.expiresAt.getTime() < Date.now()) throw new TelegramHandoffError("EXPIRED", "Handoff expired");
    if (!isApprovedHandoffDestination(row.destination)) {
      throw new TelegramHandoffError("BAD_DESTINATION", "Destination not allow-listed");
    }
    const user = await getAuthUserById(row.appUserId);
    if (!user || !user.isActive) throw new TelegramHandoffError("USER_INACTIVE", "User inactive");
    row.consumedAt = new Date();
    await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
      type: "handoff_consumed",
      appUserId: row.appUserId,
      destination: row.destination,
    });
    return {
      appUserId: row.appUserId,
      destination: row.destination,
      userJson: JSON.stringify({ user, issuedAt: Date.now() }),
    };
  }

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient();
  const row = await db.telegramWebHandoff.findUnique({ where: { tokenHash } });
  if (!row) throw new TelegramHandoffError("INVALID", "Invalid handoff");
  if (row.consumedAt) throw new TelegramHandoffError("USED", "Handoff already used");
  if (row.expiresAt.getTime() < Date.now()) throw new TelegramHandoffError("EXPIRED", "Handoff expired");
  if (!isApprovedHandoffDestination(row.destination)) {
    throw new TelegramHandoffError("BAD_DESTINATION", "Destination not allow-listed");
  }

  const user = await getAuthUserById(row.appUserId);
  if (!user || !user.isActive) throw new TelegramHandoffError("USER_INACTIVE", "User inactive");

  await db.telegramWebHandoff.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  await recordTelegramIdentityAudit(args.auditSink ?? createConsoleTelegramIdentityAuditSink(), {
    type: "handoff_consumed",
    appUserId: row.appUserId,
    destination: row.destination,
  });

  return {
    appUserId: row.appUserId,
    destination: row.destination,
    userJson: JSON.stringify({ user, issuedAt: Date.now() }),
  };
}
