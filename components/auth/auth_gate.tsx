/**
 * AuthGate (Phase 47 — client-side enforcement + no-flash guard).
 *
 * The second enforcement layer (see proxy.ts for the first). Wraps every
 * protected page's content inside AppShell and:
 *
 *   • redirects unauthenticated users to /login (belt-and-suspenders with the
 *     server proxy — also covers client-side navigations and the window where
 *     the cookie exists but storage was cleared);
 *   • enforces per-route authorization by CAPABILITY (never role name) using
 *     the centralized ROUTE_PERMISSIONS map + the user's granted permissions;
 *   • prevents any FLASH of protected content — while auth is resolving, or
 *     when a redirect is pending, it renders NOTHING (not the page).
 *
 * Authorization uses can()/hasPermission() only. A user who lacks the route's
 * permission is sent to their own home (homeRouteForUser), never shown the page.
 *
 * Navigation uses declarative `redirect()` (not imperative `router.replace` in
 * an effect). Combined with `return null`, `router.replace` triggered a Next.js
 * App Router hooks mismatch; `redirect()` after mount avoids that while keeping
 * the same RBAC outcomes. Redirects wait for mount so the empty SSR session
 * snapshot never sends a signed-in user to /login.
 *
 * When AUTH_ENFORCED is false this component is a pass-through (renders children
 * unchanged), so the app's soft-guard behavior is preserved by one flag.
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { redirect, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth_provider";
import {
  AUTH_ENFORCED,
  LOGIN_ROUTE,
  isPublicRoute,
  requiredPermissionForRoute,
  homeRouteForUser,
} from "@/lib/auth/auth_config";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, status, can } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Not enforced, or a public route (login) → pass straight through.
  const gated = AUTH_ENFORCED && !isPublicRoute(pathname);

  const unauthenticated = gated && status === "unauthenticated";
  const required = gated ? requiredPermissionForRoute(pathname) : null;
  // Authenticated but lacking the route's capability.
  const forbidden =
    gated && status === "authenticated" && required != null && !can(required);

  if (!gated) return <>{children}</>;

  // Wait for client mount so AuthProvider's real session is visible before any
  // redirect decision (SSR/hydration snapshot is always unauthenticated).
  if (!mounted) return null;

  if (unauthenticated) {
    redirect(LOGIN_ROUTE);
  }
  if (forbidden && user) {
    // Signed in but not allowed here → their own home, never the page.
    redirect(homeRouteForUser(user));
  }

  // No flash: render nothing until we KNOW the user is authenticated AND
  // authorized for this route.
  if (status !== "authenticated") return null;
  if (forbidden) return null;

  return <>{children}</>;
}
