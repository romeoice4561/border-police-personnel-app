/**
 * AppShell (Phase 14 UI): responsive nav + content frame shared by every
 * dashboard page. Sidebar on desktop, top bar with horizontally-scrollable
 * nav on mobile/tablet. Active link is highlighted from the current pathname.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, Search, BarChart3, ClipboardCheck, ShieldCheck, Images } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { EnvironmentBadge } from "@/components/layout/environment_badge";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/officers", label: "Officers", icon: Users },
  { href: "/search", label: "Search", icon: Search },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/gallery", label: "คลังรูปภาพ", icon: Images },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
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
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-surface">
        <div className="flex items-center gap-2 px-5 py-5">
          <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold leading-tight">
            Border Patrol
            <span className="block text-xs font-normal text-muted">Personnel Intelligence</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="mt-auto px-5 py-4">
          <EnvironmentBadge />
        </div>
      </aside>

      {/* Top bar (mobile/tablet) */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface md:hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold">Border Patrol Personnel</span>
          <span className="ml-auto">
            <EnvironmentBadge />
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <NavLinks pathname={pathname} />
        </nav>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
