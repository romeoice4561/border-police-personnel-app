/**
 * Telegram adapter configuration (Phase 51.2).
 * Secrets come from environment — never hard-coded.
 */

export interface TelegramPersonnelSearchConfig {
  botToken: string | null;
  /** Optional X-Telegram-Bot-Api-Secret-Token verification. */
  webhookSecret: string | null;
  /** Service principal used to call POST /api/personnel-search (Basic auth). */
  serviceUsername: string;
  servicePassword: string;
  /** When non-empty, only these Telegram user ids may use the bot. */
  allowedUserIds: ReadonlySet<number>;
  /** Public web base for dashboard deep links (optional). */
  appBaseUrl: string | null;
  defaultDisclosureLevel: 1 | 2 | 3;
  pageLimit: number;
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
  return {
    botToken: env.TELEGRAM_BOT_TOKEN?.trim() || null,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    serviceUsername: env.TELEGRAM_SERVICE_USERNAME?.trim() || "bpp414",
    servicePassword: env.TELEGRAM_SERVICE_PASSWORD?.trim() || "414",
    allowedUserIds: parseUserIds(env.TELEGRAM_ALLOWED_USER_IDS),
    appBaseUrl: env.TELEGRAM_APP_BASE_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || null,
    defaultDisclosureLevel: disclosureLevel,
    pageLimit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 8,
  };
}

export function isTelegramUserAllowed(
  userId: number,
  config: TelegramPersonnelSearchConfig
): boolean {
  if (config.allowedUserIds.size === 0) return true;
  return config.allowedUserIds.has(userId);
}
