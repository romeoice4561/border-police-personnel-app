/**
 * WorkspaceHeader (Phase 48A — Enterprise Workspace Foundation).
 *
 * The unified page header for the enterprise workspace layout: breadcrumb,
 * large title, subtitle, "last updated" timestamp, and an optional action-
 * button row (via WorkspaceActions). Every migrating page composes this the
 * same way, so header structure/spacing/typography stay identical across the
 * app instead of each page hand-rolling its own header markup.
 *
 * This SUPERSEDES ad-hoc headers on pages that adopt it (starting with
 * Dashboard, Phase 48A) — it does not replace the existing lightweight
 * PageHeader/TranslatedPageHeader, which the not-yet-migrated pages
 * (Personnel, Search, Review, Gallery, Statistics, Commander Search) keep
 * using unchanged until Phase 48B migrates them one by one.
 *
 * Pure presentation: all copy is passed in already-resolved (translated) by
 * the caller, so this component has no i18n dependency itself and works
 * equally from a Server or Client page component.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { WorkspaceBreadcrumb, type WorkspaceBreadcrumbItem } from "@/components/workspace/workspace_breadcrumb";

export interface WorkspaceHeaderProps {
  /** Large page title (required). */
  title: string;
  /** Short supporting line under the title. */
  subtitle?: string;
  /** Breadcrumb trail; omit or pass an empty array to hide it. */
  breadcrumb?: WorkspaceBreadcrumbItem[];
  /**
   * "Last updated" timestamp, already formatted by the caller (locale/format
   * concerns stay with the page, not this layout component). Rendered as a
   * small muted label near the title.
   */
  lastUpdatedLabel?: string;
  /** Optional action-button row (right-aligned on wide screens) — wrap children in WorkspaceActions or pass it directly. */
  actions?: ReactNode;
  className?: string;
}

export function WorkspaceHeader({ title, subtitle, breadcrumb, lastUpdatedLabel, actions, className }: WorkspaceHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumb && breadcrumb.length > 0 ? <WorkspaceBreadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
          {lastUpdatedLabel ? <p className="mt-1 text-xs text-muted/80">{lastUpdatedLabel}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
