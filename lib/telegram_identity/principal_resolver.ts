/**
 * Resolve Telegram numeric user id → IntelligenceActor (Phase 51.3).
 * No permission rules here — only identity + account status.
 */

import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import {
  actorFromAuthUser,
  type IntelligenceActor,
} from "@/lib/personnel_intelligence_service/permissions";
import {
  getMemoryTelegramIdentityStore,
  useMemoryTelegramIdentityStore,
} from "@/lib/telegram_identity/memory_store";
import type { TelegramPrincipalFailureCode } from "@/lib/telegram_identity/types";

export type ResolveTelegramPrincipalResult =
  | { ok: true; actor: IntelligenceActor; bindingId: string }
  | { ok: false; code: TelegramPrincipalFailureCode };

/**
 * Canonical principal resolution for Telegram.
 * Telegram username is ignored for authorization.
 */
export async function resolveTelegramPrincipal(
  telegramUserId: string | number
): Promise<ResolveTelegramPrincipalResult> {
  const id = String(telegramUserId);

  let binding: {
    id: string;
    status: string;
    appUserId: string;
  } | null = null;

  if (useMemoryTelegramIdentityStore()) {
    const store = getMemoryTelegramIdentityStore();
    const row = [...store.bindings.values()].find((b) => b.telegramUserId === id) ?? null;
    binding = row;
  } else {
    const { createDatabaseClient } = await import("@/lib/database/database");
    const db = createDatabaseClient();
    binding = await db.telegramIdentityBinding.findUnique({
      where: { telegramUserId: id },
    });
  }

  if (!binding) return { ok: false, code: "UNBOUND" };
  if (binding.status === "REVOKED") return { ok: false, code: "REVOKED" };
  if (binding.status === "DISABLED" || binding.status === "PENDING_VERIFICATION") {
    return { ok: false, code: "DISABLED" };
  }
  if (binding.status !== "ACTIVE") return { ok: false, code: "UNBOUND" };

  const user = await getAuthUserById(binding.appUserId);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };
  if (!user.isActive) return { ok: false, code: "USER_INACTIVE" };

  return { ok: true, actor: actorFromAuthUser(user), bindingId: binding.id };
}
