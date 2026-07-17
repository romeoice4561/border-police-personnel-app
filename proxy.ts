/**
 * Proxy (Phase 47 — server-side route protection).
 *
 * In this Next.js version the `middleware` file convention is renamed to
 * `proxy` (runs on the server before a route renders). This is the FIRST of
 * the two enforcement layers:
 *
 *   1. proxy.ts (here) — server-side. Blocks direct-URL entry: any request for
 *      a protected route with NO session cookie is redirected to /login before
 *      the page renders, so protected server output never reaches an
 *      unauthenticated client.
 *   2. AuthGate (client, in AppShell) — enforces role/permission access and
 *      prevents any flash of protected content once the page is loaded.
 *
 * The mock session detail (role, permissions) lives in localStorage and is NOT
 * available to the server; the proxy only checks session PRESENCE via the
 * non-HttpOnly `bppis_session` cookie the AuthProvider mirrors. Fine-grained
 * capability checks (which role may open which route) are done client-side by
 * AuthGate against the permission model. When a real backend arrives, this
 * proxy is where a signed/HttpOnly session token would be verified.
 *
 * Additive: it changes no business logic, no API, no data. It only redirects
 * unauthenticated navigations to the login screen.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_ENFORCED, LOGIN_ROUTE, SESSION_COOKIE_NAME, isPublicRoute } from "@/lib/auth/auth_config";

export function proxy(request: NextRequest) {
  // Master switch off → never interfere (soft-guard behavior).
  if (!AUTH_ENFORCED) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Public routes (login) are always reachable.
  if (isPublicRoute(pathname)) return NextResponse.next();

  // Session presence is signalled by the mirrored cookie. Absent → not signed
  // in → send to /login, preserving the intended destination for after login.
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    const loginUrl = new URL(LOGIN_ROUTE, request.url);
    const dest = pathname + request.nextUrl.search;
    if (dest && dest !== "/") loginUrl.searchParams.set("from", dest);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Run on every navigable route, but never on Next internals, API routes, or
   * static assets (so CSS/JS/images/the login page's logo always load). Auth
   * for API routes is out of scope this phase (no API change). `manifest.json`
   * (Phase 48A.2 — web app manifest referencing the branding icons) is a
   * public static file every browser/PWA installer fetches unauthenticated by
   * design — same category as favicon.ico, so it's excluded the same way.
   */
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico|manifest.json).*)"],
};
