/**
 * Auth configuration (Phase 46 — Authentication Foundation).
 *
 * The SINGLE place that decides auth behavior. Flipping `AUTH_ENFORCED` to true
 * in a later phase turns on global route protection with NO application
 * refactor — every guard already reads this flag.
 *
 * Also the centralized role → home-route helper (requirement 3): the login
 * screen never hardcodes where a role lands; it asks `homeRouteForUser()`.
 *
 * Pure — no I/O, no React.
 */

import type { AuthUser } from "@/lib/auth/types";
import type { Role } from "@/lib/auth/roles";

/**
 * MASTER SWITCH. `false` this phase → the guard is opt-in and existing pages
 * are NOT gated (the app behaves exactly as today). A future phase sets this to
 * `true` (and adds middleware) to enforce auth globally — the only change
 * needed to turn authentication on.
 */
export const AUTH_ENFORCED = false;

/** Where unauthenticated users are sent when the guard is enforced. */
export const LOGIN_ROUTE = "/login";

/** Default landing route after login when a role has no more specific home. */
export const DEFAULT_HOME_ROUTE = "/dashboard";

/**
 * Centralized Officer home (requirement 4). A future officer login lands on
 * `/me` — a single, stable route that resolves to the signed-in officer's own
 * profile — so no caller needs to know the officer's id to route them home.
 * Admin/Commander continue to use the dashboard.
 */
export const OFFICER_HOME_ROUTE = "/me";

/** localStorage/cookie key holding the mock session JSON. */
export const SESSION_STORAGE_KEY = "bppis.session";

/** Cookie name mirroring the session (non-HttpOnly, foundation only) so a future middleware can read presence. */
export const SESSION_COOKIE_NAME = "bppis_session";

/**
 * Role → home route (requirement 3). Admin/Commander → Dashboard; Officer →
 * their own profile. Centralized so the routing rule lives in ONE place and the
 * login page stays dumb.
 */
export function homeRouteForRole(role: Role): string {
  switch (role) {
    case "admin":
    case "commander":
      return DEFAULT_HOME_ROUTE;
    case "officer":
      // Officers always land on the centralized /me route, which resolves to
      // their own profile — callers never need the officer id to route home.
      return OFFICER_HOME_ROUTE;
  }
}

/** Home route for a specific user. Officers → /me (centralized); admin/commander → dashboard. */
export function homeRouteForUser(user: Pick<AuthUser, "role" | "officerId">): string {
  return homeRouteForRole(user.role);
}
