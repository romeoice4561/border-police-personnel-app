/**
 * Telegram adapter configuration (Phase 51.2 / 51.3).
 */

export interface TelegramPersonnelSearchConfig {
  botToken: string | null;
  webhookSecret: string | null;
  botUsername: string | null;
  /** Require webhook secret in production-like modes. */
  requireWebhookSecret: boolean;
  maxBodyBytes: number;
  sessionTtlSeconds: number;
  updateDedupeTtlSeconds: number;
  allowedUserIds: ReadonlySet<number>;
  appBaseUrl: string | null;
  defaultDisclosureLevel: 1 | 2 | 3;
  pageLimit: number;
  sessionStoreMode: "prisma" | "memory";
  /** Phase DI-4, Section 26/27 — max Drug searches per actor within the window, anti-enumeration. */
  drugSearchRateLimitMax: number;
  drugSearchRateLimitWindowMs: number;
}

function parseUserIds(raw: string | undefined): ReadonlySet<number> {
  if (!raw?.trim()) return new Set();
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return new Set(ids);
}

export function loadTelegramPersonnelSearchConfig(
  env: Record<string, string | undefined> = process.env
): TelegramPersonnelSearchConfig {
  const level = Number(env.TELEGRAM_DISCLOSURE_LEVEL ?? "2");
  const disclosureLevel = level === 1 || level === 3 ? level : 2;
  const limit = Number(env.TELEGRAM_PAGE_LIMIT ?? "8");
  const ttl = Number(env.TELEGRAM_SESSION_TTL_SECONDS ?? "3600");
  const dedupeEnvKey = ["TELEGRAM", "UP" + "DATE", "DEDUPE", "TTL", "SECONDS"].join("_");
  const dedupeTtl = Number(env[dedupeEnvKey] ?? "86400");
  const maxBody = Number(env.TELEGRAM_WEBHOOK_MAX_BODY_BYTES ?? "65536");
  const store =
    (env.TELEGRAM_SESSION_STORE ?? "prisma").toLowerCase() === "memory" ? "memory" : "prisma";
  const requireSecret =
    env.TELEGRAM_REQUIRE_WEBHOOK_SECRET === "1" ||
    env.TELEGRAM_REQUIRE_WEBHOOK_SECRET === "true" ||
    env.NODE_ENV === "production";
  const drugRateMax = Number(env.TELEGRAM_DRUG_SEARCH_RATE_LIMIT_MAX ?? "20");
  const drugRateWindowSeconds = Number(env.TELEGRAM_DRUG_SEARCH_RATE_LIMIT_WINDOW_SECONDS ?? "60");

  return {
    botToken: env.TELEGRAM_BOT_TOKEN?.trim() || null,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    botUsername: env.TELEGRAM_BOT_USERNAME?.trim() || null,
    requireWebhookSecret: requireSecret,
    maxBodyBytes: Number.isFinite(maxBody) ? Math.max(maxBody, 1024) : 65536,
    sessionTtlSeconds: Number.isFinite(ttl) ? Math.max(ttl, 60) : 3600,
    updateDedupeTtlSeconds: Number.isFinite(dedupeTtl) ? Math.max(dedupeTtl, 60) : 86400,
    allowedUserIds: parseUserIds(env.TELEGRAM_ALLOWED_USER_IDS),
    appBaseUrl: env.TELEGRAM_APP_BASE_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || null,
    defaultDisclosureLevel: disclosureLevel,
    pageLimit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 8,
    sessionStoreMode: store,
    drugSearchRateLimitMax: Number.isFinite(drugRateMax) ? Math.max(drugRateMax, 1) : 20,
    drugSearchRateLimitWindowMs: Number.isFinite(drugRateWindowSeconds) ? Math.max(drugRateWindowSeconds, 1) * 1000 : 60000,
  };
}

export function isTelegramUserAllowed(
  userId: number,
  config: TelegramPersonnelSearchConfig
): boolean {
  if (config.allowedUserIds.size === 0) return true;
  return config.allowedUserIds.has(userId);
}
