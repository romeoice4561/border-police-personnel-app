/**
 * UserMenu (Phase 46 foundation — header user menu).
 *
 * Shows the signed-in user's avatar placeholder, display name, localized role
 * label, and a Logout action. Renders NOTHING when there is no session, so it
 * has zero effect on the current (soft-guard, usually signed-out) app. A
 * dropdown disclosure — keyboard-accessible, closes on outside click / Escape.
 *
 * Role → label is a pure display mapping (dictionary keys); it is NOT UI
 * authorization. Any capability gating elsewhere uses hasPermission()/can().
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import type { Role } from "@/lib/auth/roles";
import { LOGIN_ROUTE } from "@/lib/auth/auth_config";
import { cn } from "@/lib/ui/cn";

const ROLE_LABEL_KEY: Record<Role, TranslationKey> = {
  admin: "auth.roleAdmin",
  commander: "auth.roleCommander",
  officer: "auth.roleOfficer",
};

/** First letter of the display name for the avatar placeholder. */
function initial(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Foundation: no session → nothing renders (existing app is unaffected).
  if (!user) return null;

  function handleLogout() {
    setOpen(false);
    logout();
    router.replace(LOGIN_ROUTE);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("auth.userMenu")}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent" aria-hidden="true">
          {initial(user.displayName)}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium text-foreground sm:inline">{user.displayName}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent" aria-hidden="true">
              {initial(user.displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
              <p className="flex items-center gap-1 text-xs text-muted">
                <UserRound className="h-3 w-3" aria-hidden="true" />
                {t(ROLE_LABEL_KEY[user.role])}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-neutral-bg focus:outline-none focus-visible:bg-neutral-bg"
          >
            <LogOut className="h-4 w-4 text-muted" aria-hidden="true" />
            {t("auth.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
