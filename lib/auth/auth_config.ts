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
import type { Role, Permission } from "@/lib/auth/roles";

/**
 * MASTER SWITCH (Phase 47 — enforcement ON).
 *
 * `true` → authentication is enforced globally: every route except the public
 * ones (LOGIN_ROUTE) requires a session. The server-side `proxy.ts` redirects
 * requests with no session cookie to /login; the client `AuthGate` (in
 * AppShell) enforces per-route permission access and prevents any flash of
 * protected content. Flipping this back to `false` restores the soft-guard
 * (opt-in) behavior with no other change.
 */
export const AUTH_ENFORCED = true;

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

// ── Route protection (Phase 47) ────────────────────────────────────────────
//
// Authorization is by CAPABILITY, never role name. Each protected top-level
// route declares the ONE permission a user must hold to open it; the client
// AuthGate and the sidebar both read this single map, so page access and menu
// visibility can never drift apart. A route absent from the map requires only
// authentication (any signed-in user), not a specific capability.

/**
 * Publicly reachable routes (no session required). Everything else is gated
 * once AUTH_ENFORCED is true.
 */
export const PUBLIC_ROUTES: readonly string[] = [LOGIN_ROUTE];

/**
 * Top-level route → required permission. Longest-prefix match wins (so
 * `/admin/portraits/x` inherits `/admin/portraits`).
 *
 * `exact: true` gates ONLY the index route (and its trailing slash), not the
 * subtree. `/officers` uses it: the officer DIRECTORY (index) needs
 * `officers.view` (admin/commander), but an individual profile
 * `/officers/[id]` is reachable by any authenticated user — an officer can open
 * a colleague's profile from Search and see the restricted view (header +
 * Capability Summary only; the profile page renders the restricted content
 * itself, by capability). `/me` is intentionally unlisted (every role may see
 * its own profile — officer.viewOwn is universal).
 */
export const ROUTE_PERMISSIONS: ReadonlyArray<{ prefix: string; permission: Permission; exact?: boolean }> = [
  { prefix: "/dashboard", permission: "dashboard.view" },
  { prefix: "/commander-search", permission: "commander.search" },
  { prefix: "/officers", permission: "officers.view", exact: true },
  { prefix: "/search", permission: "search.view" },
  { prefix: "/statistics", permission: "statistics.view" },
  { prefix: "/review", permission: "review.view" },
  { prefix: "/gallery", permission: "gallery.view" },
  { prefix: "/admin/portraits", permission: "profile.manage" },
];

/** True when `pathname` is public (no auth required). */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** True when `entry` matches `pathname` (respecting its `exact` flag). */
function routeMatches(entry: { prefix: string; exact?: boolean }, pathname: string): boolean {
  if (entry.exact) return pathname === entry.prefix || pathname === `${entry.prefix}/`;
  return pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`);
}

/**
 * The permission required to open `pathname`, or null when the route needs only
 * authentication (no specific capability). Longest matching prefix wins.
 */
export function requiredPermissionForRoute(pathname: string): Permission | null {
  let best: { prefix: string; permission: Permission } | null = null;
  for (const entry of ROUTE_PERMISSIONS) {
    if (routeMatches(entry, pathname)) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry;
    }
  }
  return best?.permission ?? null;
}
