/**
 * Auth domain types (Phase 46 — Authentication Foundation).
 *
 * Framework-free. `AuthUser` is the full user model; officer users will later
 * map directly to an Officer record via `officerId`. Permissions live ON the
 * user (independent of role) so the UI gates on capabilities.
 *
 * Pure types — no I/O, no React, no DB.
 */

import type { Role, Permission } from "@/lib/auth/roles";

/** The authenticated user model (requirement 2). */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  /** Effective permissions — seeded from the role but independently grantable/revocable later. */
  permissions: Permission[];
  /** For officer users: the linked Officer.officerId (business id). Null for admin/commander. */
  officerId: string | null;
  /** True until the user completes a forced first-login password change (modelled; not enforced this phase). */
  mustChangePassword: boolean;
  /** Soft account enable/disable flag. */
  isActive: boolean;
}

/** A client-side session (mock — no server/JWT this phase). */
export interface Session {
  user: AuthUser;
  /** Epoch ms when the session was established (for future expiry logic). */
  issuedAt: number;
}

/** Result of an authentication attempt. */
export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: AuthErrorCode };

/** Stable, translatable auth error codes (never raw messages — the UI maps these to dictionary keys). */
export type AuthErrorCode = "INVALID_CREDENTIALS" | "ACCOUNT_DISABLED" | "UNKNOWN";

/**
 * LoginAudit (Phase 46 foundation — interface only, NO database yet).
 *
 * Shape of a single login/logout audit record for a future security-audit
 * phase. Declared now so the AuthBackend/AuthProvider contract is ready to
 * emit these once a persistence layer exists; nothing writes or reads them yet.
 * `logoutAt` is null until the matching sign-out. `ip` is captured server-side
 * later (the client never trusts its own IP).
 */
export interface LoginAudit {
  /** The user this audit entry belongs to (AuthUser.id). */
  userId: string;
  /** When the session was established. */
  loginAt: number;
  /** When the session ended, or null while still active. */
  logoutAt: number | null;
  /** Coarse device descriptor (e.g. "desktop" | "mobile" | "tablet"), derived from the user agent. */
  device: string | null;
  /** Browser descriptor (e.g. "Chrome 120"), derived from the user agent. */
  browser: string | null;
  /** Client IP — resolved server-side in a future phase; null in the mock foundation. */
  ip: string | null;
}
