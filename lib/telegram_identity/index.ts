/**
 * Telegram identity binding — public surface (Phase 51.3).
 */
export * from "@/lib/telegram_identity/types";
export * from "@/lib/telegram_identity/crypto";
export * from "@/lib/telegram_identity/audit";
export * from "@/lib/telegram_identity/rate_limit";
export {
  createMemoryTelegramSessionStoreV2,
  createPrismaTelegramSessionStore,
  createTelegramSessionStoreFromEnv,
  TELEGRAM_SESSION_SCHEMA_VERSION,
  type TelegramSessionStoreV2,
} from "@/lib/telegram_identity/session_store";
export {
  createMemoryUpdateDedupeStore,
  createPrismaUpdateDedupeStore,
  createUpdateDedupeStoreFromEnv,
  normalizeUpdateId,
  type TelegramUpdateDedupeStore,
} from "@/lib/telegram_identity/update_dedupe";
export {
  createBindingToken,
  completeBindingFromStartToken,
  getBindingPublicView,
  revokeBindingForAppUser,
  touchBindingLastUsed,
  TelegramBindingError,
} from "@/lib/telegram_identity/binding_service";
export {
  resolveTelegramPrincipal,
  type ResolveTelegramPrincipalResult,
} from "@/lib/telegram_identity/principal_resolver";
export {
  createWebHandoff,
  consumeWebHandoff,
  isApprovedHandoffDestination,
  TelegramHandoffError,
} from "@/lib/telegram_identity/handoff";
export {
  getMemoryTelegramIdentityStore,
  resetMemoryTelegramIdentityStore,
  useMemoryTelegramIdentityStore,
} from "@/lib/telegram_identity/memory_store";
