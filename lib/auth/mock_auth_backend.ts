/**
 * Mock AuthBackend (Phase 46 — Authentication Foundation).
 *
 * An in-memory implementation of the AuthBackend contract for this phase — no
 * DB, no JWT, no server session. Seeded with the two test accounts from the
 * spec. Officer accounts are MODELLED (the shape below shows exactly how a
 * future officer user — username = national ID, mustChangePassword on first
 * login, linked officerId — will look) but none are seeded yet.
 *
 * Swapping to a real provider means implementing AuthBackend elsewhere and
 * returning it from getAuthBackend(); nothing else changes.
 *
 * Pure — no React. (Async to match the real-backend signature.)
 */

import type { AuthBackend } from "@/lib/auth/auth_backend";
import type { AuthResult, AuthUser } from "@/lib/auth/types";
import { defaultPermissionsForRole, type Role } from "@/lib/auth/roles";

interface MockCredential {
  username: string;
  password: string;
  displayName: string;
  role: Role;
  officerId: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
}

/**
 * Seeded test accounts (spec):
 *   admin   / 414  → Administrator (admin)
 *   BPP414  / 414  → Commander (commander)
 * Officer accounts are NOT seeded yet — the commented shape documents the
 * future model (national-ID username, forced first-login password change).
 */
const MOCK_CREDENTIALS: readonly MockCredential[] = [
  { username: "admin", password: "414", displayName: "Administrator", role: "admin", officerId: null, mustChangePassword: false, isActive: true },
  { username: "bpp414", password: "414", displayName: "Commander BPP414", role: "commander", officerId: null, mustChangePassword: false, isActive: true },
  // Future officer example (NOT active this phase):
  // { username: "1100701234567", password: "414", displayName: "…", role: "officer", officerId: "ภาค4/20", mustChangePassword: true, isActive: true },
];

function toAuthUser(cred: MockCredential): AuthUser {
  return {
    id: `mock:${cred.username}`,
    username: cred.username,
    displayName: cred.displayName,
    role: cred.role,
    permissions: defaultPermissionsForRole(cred.role),
    officerId: cred.officerId,
    mustChangePassword: cred.mustChangePassword,
    isActive: cred.isActive,
  };
}

export class MockAuthBackend implements AuthBackend {
  async authenticate(username: string, password: string): Promise<AuthResult> {
    // Small delay so the UI's loading state is observable (mimics a network round-trip).
    await new Promise((resolve) => setTimeout(resolve, 250));

    const normalized = username.trim().toLowerCase();
    const cred = MOCK_CREDENTIALS.find((c) => c.username.toLowerCase() === normalized);
    if (!cred || cred.password !== password) {
      return { ok: false, error: "INVALID_CREDENTIALS" };
    }
    if (!cred.isActive) {
      return { ok: false, error: "ACCOUNT_DISABLED" };
    }
    return { ok: true, user: toAuthUser(cred) };
  }

  async signOut(): Promise<void> {
    // No server session to revoke in the mock backend.
  }
}

let backend: AuthBackend = new MockAuthBackend();

/** Returns the active AuthBackend. A future phase swaps the mock for a real provider here — the ONLY change needed. */
export function getAuthBackend(): AuthBackend {
  return backend;
}

/** Test/DI hook to inject a different backend. */
export function setAuthBackend(next: AuthBackend): void {
  backend = next;
}
