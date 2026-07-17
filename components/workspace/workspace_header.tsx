/**
 * WorkspaceHeader (Phase 48A — Enterprise Workspace Foundation;
 * Phase 48A.1 — statusBadge slot + centralized typography).
 *
 * The unified page header for the enterprise workspace layout: breadcrumb,
 * large title (with an optional status badge next to it), subtitle, "last
 * updated" timestamp, and an optional action-button row (via
 * WorkspaceActions). Every migrating page composes this the same way, so
 * header structure/spacing/typography stay identical across the app instead
 * of each page hand-rolling its own header markup.
 *
 * This SUPERSEDES ad-hoc headers on pages that adopt it (starting with
 * Dashboard, Phase 48A) — it does not replace the existing lightweight
 * PageHeader/TranslatedPageHeader, which the not-yet-migrated pages
 * (Personnel, Search, Review, Gallery, Statistics, Commander Search) keep
 * using unchanged until Phase 48B migrates them one by one.
 *
 * Pure presentation: all copy is passed in already-resolved (translated) by
 * the caller, so this component has no i18n dependency itself and works
 * equally from a Server or Client page component. Sizes come from
 * WORKSPACE_TYPOGRAPHY, not inline literals.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { WorkspaceBreadcrumb, type WorkspaceBreadcrumbItem } from "@/components/workspace/workspace_breadcrumb";
import { WORKSPACE_TYPOGRAPHY } from "@/components/workspace/workspace_typography";

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
  /**
   * Optional status indicator next to the title (e.g. a Badge reading
   * "Live"/"Draft"/"Needs Attention"). Pure slot — this component doesn't
   * define what a "status" is, the caller passes any ReactNode (typically
   * the existing Badge primitive).
   */
  statusBadge?: ReactNode;
  /** Optional action-button row (right-aligned on wide screens) — wrap children in WorkspaceActions or pass it directly. */
  actions?: ReactNode;
  className?: string;
}

export function WorkspaceHeader({ title, subtitle, breadcrumb, lastUpdatedLabel, statusBadge, actions, className }: WorkspaceHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumb && breadcrumb.length > 0 ? <WorkspaceBreadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className={WORKSPACE_TYPOGRAPHY.pageTitle}>{title}</h1>
            {statusBadge ?? null}
          </div>
          {subtitle ? <p className={cn("mt-1.5", WORKSPACE_TYPOGRAPHY.pageSubtitle)}>{subtitle}</p> : null}
          {lastUpdatedLabel ? <p className={cn("mt-1", WORKSPACE_TYPOGRAPHY.pageMeta)}>{lastUpdatedLabel}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
