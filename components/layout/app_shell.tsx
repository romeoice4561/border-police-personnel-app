/**
 * AppShell (Phase 14 UI; Phase 48A enterprise sidebar; Phase 48A.1 enterprise
 * sidebar/theme visual completion): responsive nav + content frame shared by
 * every dashboard page. Collapsible enterprise sidebar on desktop, top bar
 * with horizontally-scrollable nav on mobile/tablet. Active link is
 * highlighted from the current pathname.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, Search, BarChart3, ClipboardCheck, Images, UserCheck, SlidersHorizontal, UserCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { EnvironmentBadge } from "@/components/layout/environment_badge";
import { LanguageToggle } from "@/components/ui/language_toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/auth/user_menu";
import { AppearanceSwitcher } from "@/components/theme/appearance_switcher";
import { BppisLogo } from "@/components/auth/bppis_logo";
import { SidebarBrand } from "@/components/layout/sidebar_brand";
import { AuthGate } from "@/components/auth/auth_gate";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useStatistics } from "@/lib/ui/hooks";
import { AUTH_ENFORCED, LOGIN_ROUTE } from "@/lib/auth/auth_config";
import type { Permission } from "@/lib/auth/roles";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { SIDEBAR_WIDTH_EXPANDED_CLASS, SIDEBAR_WIDTH_COLLAPSED_CLASS } from "@/lib/layout/sidebar_layout";
import { useSidebarCollapsed } from "@/lib/layout/use_sidebar_collapsed";

/**
 * A sidebar item's optional live badge (Phase 48A.1 Part C). ONLY populated
 * from data that already has a reliable, site-wide total via the existing
 * query layer — never invented, never a per-page/partial count. Today that is
 * exactly one item (Personnel → total officers, via the same useStatistics()
 * TanStack Query hook the Statistics page already uses — shared cache, no
 * duplicate fetch). Data Quality Center and Media Center are deliberately
 * left WITHOUT a badge: Review's "needs attention" count is only computed
 * over the current fetched page (not a true total) and Media Center has no
 * verification-count data anywhere in the app — showing either would be a
 * misleading number, which the spec explicitly rules out ("no badge is
 * better than an incorrect badge"). Wire real totals for those in a future
 * phase once a reliable aggregate exists.
 */
type NavItem = { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; permission: Permission; badge?: "totalOfficers" };
type NavGroup = { titleKey: TranslationKey | null; items: NavItem[] };

/**
 * Sidebar items, grouped into an enterprise navigation structure:
 *   Main: Dashboard / Personnel / Search Center / Analytics
 *   Operations: Data Quality Center / Media Center
 *   Administration: Profile Manager
 *
 * Grouping is PRESENTATION ONLY — every item still declares the exact same
 * CAPABILITY it did before (Phase 47), and is still filtered by
 * can(permission), never by role name. No permission, no route, and no
 * filtering rule changed. An empty group (every item filtered out) simply
 * renders no header, so a Commander's sidebar has no dangling "Administration"
 * heading with nothing under it.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.groupMain",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { href: "/officers", labelKey: "nav.officers", icon: Users, permission: "officers.view", badge: "totalOfficers" },
      { href: "/commander-search", labelKey: "nav.commanderSearch", icon: SlidersHorizontal, permission: "commander.search" },
      { href: "/search", labelKey: "nav.search", icon: Search, permission: "search.view" },
      { href: "/statistics", labelKey: "nav.statistics", icon: BarChart3, permission: "statistics.view" },
    ],
  },
  {
    titleKey: "nav.groupOperations",
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

/** Resolves a badge id to its live value. Returns null when the data isn't loaded yet or the item has no badge — a missing/loading badge renders nothing, never a stale or zero placeholder. */
function useBadgeValue(badge: NavItem["badge"]): number | null {
  const statistics = useStatistics();
  if (!badge) return null;
  if (badge === "totalOfficers") return statistics.data?.totalOfficers ?? null;
  return null;
}

function NavBadge({ value }: { value: number }) {
  return (
    <Badge tone="accent" className="ml-auto shrink-0 tabular-nums">
      {value.toLocaleString()}
    </Badge>
  );
}

/** Expanded-sidebar row: icon + label + optional badge, taller and more legible than the pre-48A.1 row. */
function NavLink({ href, labelKey, icon: Icon, badge, pathname, onNavigate }: NavItem & { pathname: string; onNavigate?: () => void }) {
  const { t } = useT();
  const badgeValue = useBadgeValue(badge);
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
        active ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
      {badgeValue != null ? <NavBadge value={badgeValue} /> : null}
    </Link>
  );
}

/** Collapsed-sidebar row: icon only, wrapped in a Tooltip carrying the label (+ badge count, since a collapsed badge dot alone would lose the number). */
function NavLinkCollapsed({ href, labelKey, icon: Icon, badge, pathname }: NavItem & { pathname: string }) {
  const { t } = useT();
  const badgeValue = useBadgeValue(badge);
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const label = badgeValue != null ? `${t(labelKey)} (${badgeValue.toLocaleString()})` : t(labelKey);
  return (
    <Tooltip label={label} className="block w-full">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={cn(
          "relative flex items-center justify-center rounded-lg p-2.5 transition-colors",
          active ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
        )}
      >
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        {badgeValue != null ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        ) : null}
      </Link>
    </Tooltip>
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

/** Desktop sidebar, EXPANDED — grouped with section headers and dividers between groups. */
function NavGroupsExpanded({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useT();
  const groups = useVisibleNavGroups();
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.titleKey ?? `group-${index}`} className={cn("flex flex-col gap-1", index > 0 && "mt-4 border-t border-border pt-4")}>
          {group.titleKey ? (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted/70">{t(group.titleKey)}</p>
          ) : null}
          {group.items.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </>
  );
}

/** Desktop sidebar, COLLAPSED — icon rail, groups separated by a divider (no text headers — there's no room). */
function NavGroupsCollapsed({ pathname }: { pathname: string }) {
  const groups = useVisibleNavGroups();
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.titleKey ?? `group-${index}`} className={cn("flex flex-col items-center gap-1", index > 0 && "mt-3 border-t border-border pt-3")}>
          {group.items.map((item) => (
            <NavLinkCollapsed key={item.href} {...item} pathname={pathname} />
          ))}
        </div>
      ))}
    </>
  );
}

/** Mobile/tablet top-bar nav — flat horizontal-scroll strip (no group headers; grouping doesn't read well in a single scrolling row). */
function NavLinksMobile({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
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
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  // Phase 46: the login route has NO app chrome (no sidebar/nav) — render its
  // content bare. This is the only change to the shell; every other route is
  // unaffected and behaves exactly as before.
  if (pathname === LOGIN_ROUTE || pathname.startsWith(`${LOGIN_ROUTE}/`)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (desktop) — width driven by the shared sidebar-layout tokens
          (lib/layout/sidebar_layout.ts), collapsible, persisted locally. */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:border-r md:border-border md:bg-surface md:transition-[width] md:duration-200",
          collapsed ? SIDEBAR_WIDTH_COLLAPSED_CLASS : SIDEBAR_WIDTH_EXPANDED_CLASS
        )}
      >
        {/* Brand — official BPP logo + fixed org/system name lockup (expanded); logo only (collapsed). */}
        <div className={cn("flex items-center gap-2.5 border-b border-border px-4 py-4", collapsed && "justify-center px-2")}>
          <div className={collapsed ? "w-9" : "w-10 shrink-0"}>
            <BppisLogo />
          </div>
          {!collapsed ? <SidebarBrand /> : null}
        </div>

        <nav className={cn("flex flex-1 flex-col overflow-y-auto py-3", collapsed ? "items-center px-2" : "px-3")}>
          {collapsed ? <NavGroupsCollapsed pathname={pathname} /> : <NavGroupsExpanded pathname={pathname} />}
        </nav>

        {/* Footer — collapse toggle + environment badge. */}
        <div className={cn("mt-auto flex flex-col gap-2 border-t border-border px-3 py-3", collapsed && "items-center px-2")}>
          <Tooltip label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")} className={collapsed ? "block" : "self-start"}>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
              aria-pressed={collapsed}
              className="flex items-center justify-center rounded-lg p-2 text-muted transition-colors hover:bg-neutral-bg hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden="true" /> : <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />}
            </button>
          </Tooltip>
          {!collapsed ? <EnvironmentBadge /> : null}
        </div>
      </aside>

      {/* Right column: global header + page content. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global top header — language switch, appearance switch, user menu,
            top-right, on every page. Desktop only: on mobile the same
            controls live in the mobile top bar below. */}
        <header className="sticky top-0 z-10 hidden border-b border-border bg-surface md:flex">
          <div className="ml-auto flex items-center gap-3 px-6 py-3 lg:px-8">
            <LanguageToggle />
            <AppearanceSwitcher />
            {/* Phase 46: header user menu — renders only when signed in. */}
            <UserMenu />
          </div>
        </header>

        {/* Top bar (mobile/tablet) — compact official logo + the same header controls, top-right. */}
        <header className="sticky top-0 z-10 border-b border-border bg-surface md:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-8 shrink-0">
              <BppisLogo />
            </div>
            <SidebarBrand compact />
            <span className="ml-auto flex items-center gap-2">
              <LanguageToggle />
              <AppearanceSwitcher />
              <UserMenu />
              <EnvironmentBadge />
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            <NavLinksMobile pathname={pathname} />
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
