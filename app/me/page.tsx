/**
 * /me — the centralized "my profile" route (Phase 46 foundation, requirement 4).
 *
 * A stable route the signed-in officer is sent to at login, so no caller needs
 * their officer id to route them home. It resolves client-side to the officer's
 * own profile (/officers/{officerId}). This is FOUNDATION: auth is still soft
 * (AUTH_ENFORCED = false) and no officer accounts are seeded yet, so today this
 * simply forwards using the mock session when present, and otherwise falls back
 * to the dashboard (or the login screen when enforcement is turned on later) —
 * never a dead end.
 *
 * No DB, no middleware, no API. Presentation/routing only.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth_provider";
import { AUTH_ENFORCED, LOGIN_ROUTE, DEFAULT_HOME_ROUTE } from "@/lib/auth/auth_config";
import { LoadingState } from "@/components/common/states";

export default function MyProfilePage() {
  const router = useRouter();
  const { user, status } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    // Signed-in officer with a linked record → their own profile.
    if (user?.role === "officer" && user.officerId) {
      router.replace(`/officers/${encodeURIComponent(user.officerId)}`);
      return;
    }
    // Signed-in non-officer → dashboard (their home).
    if (user) {
      router.replace(DEFAULT_HOME_ROUTE);
      return;
    }
    // Not signed in: only redirect to login once enforcement is on; otherwise
    // fall back to the dashboard so the current (soft-guard) app is never
    // blocked.
    router.replace(AUTH_ENFORCED ? LOGIN_ROUTE : DEFAULT_HOME_ROUTE);
  }, [router, user, status]);

  return (
    <div className="py-10">
      <LoadingState rows={4} />
    </div>
  );
}
