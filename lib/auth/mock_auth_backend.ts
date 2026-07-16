/**
 * Mock AuthBackend (Phase 46 — Authentication Foundation;
 * Phase 47.1 — officer test account seeded).
 *
 * An in-memory implementation of the AuthBackend contract for this phase — no
 * DB, no JWT, no server session. Seeded with the three test accounts from the
 * spec: admin, commander, and one officer (username = Thai national ID
 * number, password 414, NOT forced to change password — per Phase 47.1).
 * `officerId` links the officer account to a real Officer record so /me and
 * the ownership-scoped `officer.editOwn` permission resolve correctly.
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
 * Seeded test accounts (Phase 47.1 spec):
 *   admin          / 414  → Administrator (admin)
 *   BPP414         / 414  → Commander (commander)
 *   1101700123456  / 414  → Officer (officer) — username is the Thai national
 *                            ID number; NOT forced to change password on first
 *                            login (spec explicitly says no forced change).
 */
const MOCK_CREDENTIALS: readonly MockCredential[] = [
  { username: "admin", password: "414", displayName: "Administrator", role: "admin", officerId: null, mustChangePassword: false, isActive: true },
  { username: "bpp414", password: "414", displayName: "Commander BPP414", role: "commander", officerId: null, mustChangePassword: false, isActive: true },
  { username: "1101700123456", password: "414", displayName: "Officer 1101700123456", role: "officer", officerId: "ภาค4/79", mustChangePassword: false, isActive: true },
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
