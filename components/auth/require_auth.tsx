/**
 * RequireAuth (Phase 46 — Authentication Foundation, opt-in guard).
 *
 * Wraps content that should require authentication (and optionally a specific
 * permission). This phase it is NOT applied to existing pages — the soft guard
 * is OFF (AUTH_ENFORCED = false), so this component renders its children
 * unchanged and the app behaves exactly as today. When a future phase sets
 * AUTH_ENFORCED = true, this component (and a middleware) enforce access with
 * NO other change: an unauthenticated user is redirected to LOGIN_ROUTE; an
 * authenticated user lacking `permission` sees the fallback.
 *
 * Authorization is by CAPABILITY (permission), never role name.
 */
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AUTH_ENFORCED, LOGIN_ROUTE } from "@/lib/auth/auth_config";
import type { Permission } from "@/lib/auth/roles";
import { useAuth } from "@/components/auth/auth_provider";

export function RequireAuth({
  permission,
  fallback = null,
  children,
}: {
  /** Optional capability the user must hold to see `children`. */
  permission?: Permission;
  /** Rendered when enforced + authenticated but not authorized. */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { status, can } = useAuth();

  const mustRedirect = AUTH_ENFORCED && status === "unauthenticated";

  useEffect(() => {
    if (mustRedirect) router.replace(LOGIN_ROUTE);
  }, [mustRedirect, router]);

  // Soft guard OFF → always render children (today's behavior).
  if (!AUTH_ENFORCED) return <>{children}</>;

  // Enforced:
  if (status === "loading") return null;
  if (status === "unauthenticated") return null; // redirecting
  if (permission && !can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
