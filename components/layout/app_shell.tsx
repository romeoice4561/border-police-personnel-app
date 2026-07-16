/**
 * AppShell (Phase 14 UI): responsive nav + content frame shared by every
 * dashboard page. Sidebar on desktop, top bar with horizontally-scrollable
 * nav on mobile/tablet. Active link is highlighted from the current pathname.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, Search, BarChart3, ClipboardCheck, ShieldCheck, Images, UserCheck, SlidersHorizontal, UserCircle } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { EnvironmentBadge } from "@/components/layout/environment_badge";
import { LanguageToggle } from "@/components/ui/language_toggle";
import { UserMenu } from "@/components/auth/user_menu";
import { AuthGate } from "@/components/auth/auth_gate";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { AUTH_ENFORCED, LOGIN_ROUTE } from "@/lib/auth/auth_config";
import type { Permission } from "@/lib/auth/roles";
import type { TranslationKey } from "@/lib/i18n/dictionary";

/**
 * Sidebar items (Phase 47). Each declares the CAPABILITY required to see it —
 * the menu is filtered by can(permission), never by role name. Officers, for
 * example, hold only search.view + gallery.view (+ their own profile via the
 * user menu / /me), so Dashboard/Officers/Statistics/Profile-management simply
 * do not render for them.
 */
const NAV: Array<{ href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; permission: Permission }> = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/commander-search", labelKey: "nav.commanderSearch", icon: SlidersHorizontal, permission: "commander.search" },
  { href: "/officers", labelKey: "nav.officers", icon: Users, permission: "officers.view" },
  { href: "/search", labelKey: "nav.search", icon: Search, permission: "search.view" },
  { href: "/statistics", labelKey: "nav.statistics", icon: BarChart3, permission: "statistics.view" },
  { href: "/review", labelKey: "nav.review", icon: ClipboardCheck, permission: "review.view" },
  { href: "/gallery", labelKey: "nav.gallery", icon: Images, permission: "gallery.view" },
  { href: "/admin/portraits", labelKey: "nav.portraitCleanup", icon: UserCheck, permission: "profile.manage" },
];

/**
 * "My Profile" (/me) — shown only to a user who can see their OWN profile
 * (officer.viewOwn) but is NOT an officer-directory viewer (officers.view).
 * That capability combination identifies an officer without any role-name
 * check, and keeps My Profile out of the admin/commander sidebars (they use
 * the officer directory instead), matching the spec's per-role menus.
 */
const MY_PROFILE_ITEM: { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard } = {
  href: "/me",
  labelKey: "nav.myProfile",
  icon: UserCircle,
};

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useT();
  const { can } = useAuth();
  // When enforcement is on, show only items the user is authorized for
  // (hidden items are NOT rendered). When off, show everything (today's app).
  const permitted = AUTH_ENFORCED ? NAV.filter((item) => can(item.permission)) : NAV;
  const showMyProfile = AUTH_ENFORCED && can("officer.viewOwn") && !can("officers.view");
  const items = showMyProfile ? [MY_PROFILE_ITEM, ...permitted] : permitted;
  return (
    <>
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              active ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(labelKey)}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();

  // Phase 46: the login route has NO app chrome (no sidebar/nav) — render its
  // content bare. This is the only change to the shell; every other route is
  // unaffected and behaves exactly as before.
  if (pathname === LOGIN_ROUTE || pathname.startsWith(`${LOGIN_ROUTE}/`)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-surface">
        <div className="flex items-center gap-2 px-5 py-5">
          <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold leading-tight">
            {t("nav.brand")}
            <span className="block text-xs font-normal text-muted">{t("nav.brandSub")}</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <NavLinks pathname={pathname} />
        </nav>
        {/* Phase 45A Part 1: the language switch moved to the global top
            header (right column). The sidebar footer keeps only the
            environment badge. */}
        <div className="mt-auto px-5 py-4">
          <EnvironmentBadge />
        </div>
      </aside>

      {/* Right column: global header + page content. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global top header — the SINGLE language switch, top-right, on every
            page (Phase 45A Part 1). Desktop only: on mobile the switch lives in
            the mobile top bar below (also top-right). */}
        <header className="sticky top-0 z-10 hidden border-b border-border bg-surface md:flex">
          <div className="ml-auto flex items-center gap-3 px-6 py-3 lg:px-8">
            <LanguageToggle />
            {/* Phase 46: header user menu — renders only when signed in. */}
            <UserMenu />
          </div>
        </header>

        {/* Top bar (mobile/tablet) — brand + the language switch top-right + nav. */}
        <header className="sticky top-0 z-10 border-b border-border bg-surface md:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="text-sm font-semibold">{t("nav.brand")}</span>
            <span className="ml-auto flex items-center gap-2">
              <LanguageToggle />
              <UserMenu />
              <EnvironmentBadge />
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            <NavLinks pathname={pathname} />
          </nav>
        </header>

        {/* Phase 47: AuthGate enforces authentication + per-route permission
            and renders nothing until authorized (no flash of protected
            content). Pass-through when AUTH_ENFORCED is false. */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <AuthGate>{children}</AuthGate>
          </div>
        </main>
      </div>
    </div>
  );
}
