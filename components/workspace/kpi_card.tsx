/**
 * KpiCard / KpiGrid (Phase 48A — Enterprise Workspace Foundation).
 *
 * The single reusable "hero number + label + icon" tile, consolidating the
 * three near-duplicate implementations that had grown independently:
 *   - components/common/statistics_cards.tsx (StatTile)
 *   - components/intelligence/commander_summary_cards.tsx (SummaryTile)
 *   - components/commander/summary/commander_query_summary.tsx (SummaryTile)
 * All three shared the same shape (label/value/icon[/tone][/hint][/onClick])
 * on top of the same Card/CardBody primitive — this is that shape, exported
 * once. Existing call sites are UNCHANGED this phase (Phase 48A is
 * foundation-only; migrating those three to KpiCard is Phase 48B work), so
 * there is no behavior change to Statistics/Dashboard's existing tiles yet —
 * Dashboard's NEW WorkspaceHeader/KpiGrid composition uses this component as
 * its reference implementation.
 *
 * Reuses the existing StatusTone vocabulary (good/warning/serious/critical/
 * neutral) from lib/ui/quality.ts — the same reserved status-color set every
 * other tile/badge in the app already uses.
 */
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import type { StatusTone } from "@/lib/ui/quality";
import { cn } from "@/lib/ui/cn";

const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-foreground",
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatusTone;
  /** Short supporting line under the value (e.g. a band name, a delta, a unit count). */
  hint?: string;
  /** Optional drill-down action — renders the tile as a button when present. */
  onClick?: () => void;
  className?: string;
}

export function KpiCard({ label, value, icon, tone = "neutral", hint, onClick, className }: KpiCardProps) {
  const body = (
    <CardBody className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon ? (
          <span className="text-muted" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </CardBody>
  );

  if (onClick) {
    return (
      <Card className={cn("text-left transition-colors hover:border-accent/40", className)}>
        <button type="button" onClick={onClick} className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-xl">
          {body}
        </button>
      </Card>
    );
  }

  return <Card className={className}>{body}</Card>;
}

/**
 * The shared grid every KPI section uses — 2 columns on mobile, 4 on large
 * screens, identical gap everywhere (Dashboard, Personnel, Search, Gallery,
 * Review, Statistics, Media all compose this the same way).
 */
export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
