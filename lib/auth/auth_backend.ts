/**
 * AuthBackend contract (Phase 46 — Authentication Foundation).
 *
 * The provider-agnostic seam between the application and whatever authenticates
 * users (requirement 1). The UI/AuthProvider depends ONLY on this interface, so
 * a future backend — Supabase Auth, Active Directory / LDAP, Government SSO, a
 * custom API — is a drop-in replacement with NO application-layer change: build
 * a class that implements `AuthBackend`, swap it in `getAuthBackend()`.
 *
 * Pure interface — no I/O, no React.
 */

import type { AuthResult } from "@/lib/auth/types";

export interface AuthBackend {
  /** Verifies credentials and returns the authenticated user, or a stable error code. */
  authenticate(username: string, password: string): Promise<AuthResult>;
  /** Optional server-side sign-out hook (mock backend is a no-op; a real backend revokes the session). */
  signOut?(): Promise<void>;
}
