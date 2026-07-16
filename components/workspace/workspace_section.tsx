/**
 * WorkspaceSection (Phase 48A — Enterprise Workspace Foundation).
 *
 * The consistent body wrapper for a page's content blocks — cards, tables,
 * charts, lists. Gives every migrated page identical section spacing and an
 * optional titled sub-header, so the workspace body reads uniformly across
 * pages regardless of what's inside (a table on Personnel, a chart on
 * Statistics, a card list on Review).
 *
 * Purely a spacing/heading wrapper — it renders whatever the caller passes as
 * children (Card, a table, a chart component, a list) unchanged.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export interface WorkspaceSectionProps {
  /** Optional sub-header title for this block (e.g. "Recent Activity", "Unit Breakdown"). */
  title?: string;
  /** Optional short line under the title. */
  description?: string;
  /** Optional right-aligned actions for this section (e.g. a "View all" link). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WorkspaceSection({ title, description, actions, children, className }: WorkspaceSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title ? <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * The outer page wrapper — the same vertical rhythm between
 * header/KPIs/filter/sections every migrated page shares (mirrors the
 * `space-y-8` / `space-y-6` convention already used by Dashboard/Statistics).
 */
export function WorkspaceLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-8", className)}>{children}</div>;
}
