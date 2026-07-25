/**
 * Telegram identity binding contracts (Phase 51.3).
 */

export type TelegramBindingStatus = "PENDING_VERIFICATION" | "ACTIVE" | "REVOKED" | "DISABLED";

export type TelegramPrincipalFailureCode =
  | "UNBOUND"
  | "REVOKED"
  | "DISABLED"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "SCOPE_UNAVAILABLE";

export interface TelegramBindingPublicView {
  status: "UNBOUND" | TelegramBindingStatus;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  verifiedAt: string | null;
  lastUsedAt: string | null;
  /** Never expose telegramUserId to other users; owner may see masked form. */
  telegramUserIdMasked: string | null;
}

export interface BindingTokenCreateResult {
  /** Opaque raw token — show once in deep link only. */
  rawToken: string;
  expiresAt: string;
  deepLink: string;
}
