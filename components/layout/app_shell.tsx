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

type NavItem = { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; permission: Permission };
type NavGroup = { titleKey: TranslationKey | null; items: NavItem[] };

/**
 * Sidebar items, grouped into an enterprise navigation structure (Phase 48A):
 *   Dashboard / Personnel / Search Center / Analytics
 *   Data Quality Center / Media Center
 *   Administration
 *
 * Grouping is PRESENTATION ONLY — every item still declares the exact same
 * CAPABILITY it did before (Phase 47), and is still filtered by
 * can(permission), never by role name. No permission, no route, and no
 * filtering rule changed in this phase; only how the items are visually
 * organized in the sidebar. An empty group (every item filtered out) simply
 * renders no header, so a Commander's sidebar has no dangling "Administration"
 * heading with nothing under it.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: null, // Ungrouped top tier — no header, matches the spec's flat top section.
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { href: "/officers", labelKey: "nav.officers", icon: Users, permission: "officers.view" },
      { href: "/commander-search", labelKey: "nav.commanderSearch", icon: SlidersHorizontal, permission: "commander.search" },
      { href: "/search", labelKey: "nav.search", icon: Search, permission: "search.view" },
      { href: "/statistics", labelKey: "nav.statistics", icon: BarChart3, permission: "statistics.view" },
    ],
  },
  {
    titleKey: null, // Second flat tier (Data Quality Center / Media Center) — visually separated by spacing, not a labeled header, matching the spec's divider-only grouping.
    items: [
      { href: "/review", labelKey: "nav.review", icon: ClipboardCheck, permission: "review.view" },
      { href: "/gallery", labelKey: "nav.gallery", icon: Images, permission: "gallery.view" },
    ],
  },
  {
    titleKey: "nav.groupAdministration",
    items: [{ href: "/admin/portraits", labelKey: "nav.portraitCleanup", icon: UserCheck, permission: "profile.manage" }],
  },
];

/**
 * "My Profile" (/me) — shown only to a user who can see their OWN profile
 * (officer.viewOwn) but is NOT an officer-directory viewer (officers.view).
 * That capability combination identifies an officer without any role-name
 * check, and keeps My Profile out of the admin/commander sidebars (they use
 * the officer directory instead), matching the spec's per-role menus.
 */
const MY_PROFILE_ITEM: NavItem = {
  href: "/me",
  labelKey: "nav.myProfile",
  icon: UserCircle,
  // officer.viewOwn is exactly the capability that gates My Profile's
  // visibility below (showMyProfile) — recorded here only so this item
  // satisfies the shared NavItem shape; it is never separately can()-checked
  // for this item (the showMyProfile rule already decided it belongs).
  permission: "officer.viewOwn",
};

function NavLink({ href, labelKey, icon: Icon, pathname, onNavigate }: NavItem & { pathname: string; onNavigate?: () => void }) {
  const { t } = useT();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
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
}

/**
 * Filters NAV_GROUPS down to what this user may see (RBAC unchanged — same
 * can(permission) gate as before, applied per item) and drops any group left
 * empty by that filtering, so a Commander never sees a bare "Administration"
 * header with nothing under it. Prepends My Profile for an officer viewer
 * (same officer.viewOwn && !officers.view capability rule as before).
 */
function useVisibleNavGroups(): NavGroup[] {
  const { can } = useAuth();
  const permittedGroups = AUTH_ENFORCED
    ? NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter((group) => group.items.length > 0)
    : NAV_GROUPS;
  const showMyProfile = AUTH_ENFORCED && can("officer.viewOwn") && !can("officers.view");
  if (!showMyProfile) return permittedGroups;
  return [{ titleKey: null, items: [MY_PROFILE_ITEM] }, ...permittedGroups];
}

/** Desktop sidebar — grouped with optional section headers and dividers between groups. */
function NavGroups({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useT();
  const groups = useVisibleNavGroups();
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.titleKey ?? `group-${index}`} className={cn("flex flex-col gap-1", index > 0 && "mt-3 border-t border-border pt-3")}>
          {group.titleKey ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/70">{t(group.titleKey)}</p>
          ) : null}
          {group.items.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </>
  );
}

/** Mobile/tablet top-bar nav — flat horizontal-scroll strip (no group headers; grouping doesn't read well in a single scrolling row). */
function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const groups = useVisibleNavGroups();
  const items = groups.flatMap((group) => group.items);
  return (
    <>
      {items.map((item) => (
        <NavLink key={item.href} {...item} pathname={pathname} onNavigate={onNavigate} />
      ))}
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
        <nav className="flex flex-col px-3">
          <NavGroups pathname={pathname} />
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
