/**
 * KpiCard / KpiGrid (Phase 48A — Enterprise Workspace Foundation;
 * Phase 48A.1 — badge/trend/footer slots + centralized typography).
 *
 * The single reusable "hero number + label + icon" tile, consolidating the
 * three near-duplicate implementations that had grown independently:
 *   - components/common/statistics_cards.tsx (StatTile)
 *   - components/intelligence/commander_summary_cards.tsx (SummaryTile)
 *   - components/commander/summary/commander_query_summary.tsx (SummaryTile)
 * Existing call sites are UNCHANGED (Phase 48A.2+ work); Dashboard's
 * KpiGrid/KpiCard composition is the reference implementation.
 *
 * Phase 48A.1 extensibility (per the Phase 48A architecture audit — "adding
 * badge/trend/sparkline requires editing KpiCard's internals"): three new
 * OPTIONAL slots so a future badge, trend indicator, or sparkline/footer
 * visual can be dropped in via a prop, with NO further redesign:
 *   - `badge`   — small indicator next to the label (e.g. a status Badge)
 *   - `trend`   — small indicator next to the value (e.g. a ↑/↓ delta)
 *   - `footer`  — a full-width slot below the hint, sized for a future
 *                 sparkline chart (a fixed height reservation, not a chart
 *                 implementation — no charting library is introduced here)
 * All three default to nothing rendered, so every existing simple usage
 * (label/value/icon/tone/hint) is pixel-identical to before this phase.
 *
 * The clickable/non-clickable fork that existed before (two near-duplicate
 * JSX branches sharing only the `body` variable) is now a single render
 * path: `CardOrButton` picks the outer element ONCE, and everything inside
 * — including the three new slots — is written exactly once, addressing the
 * audit's second KpiCard finding directly.
 */
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import type { StatusTone } from "@/lib/ui/quality";
import { WORKSPACE_TYPOGRAPHY } from "@/components/workspace/workspace_typography";
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
  /** Small indicator next to the label — e.g. a status Badge ("New", "Beta"). */
  badge?: ReactNode;
  /** Small indicator next to the value — e.g. a ↑/↓ trend delta. */
  trend?: ReactNode;
  /** Full-width slot below the hint, for a future sparkline or mini-chart. Reserves layout space only; no chart is rendered by this component. */
  footer?: ReactNode;
  /** Optional drill-down action — renders the tile as a button when present. */
  onClick?: () => void;
  className?: string;
}

/** Renders as a <button> when `onClick` is given, a plain <div> otherwise — the ONE place that forks on clickability; everything it wraps is identical either way. */
function CardOrButton({ onClick, className, children }: { onClick?: () => void; className?: string; children: ReactNode }) {
  if (!onClick) return <Card className={className}>{children}</Card>;
  return (
    <Card className={cn("text-left transition-colors hover:border-accent/40", className)}>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {children}
      </button>
    </Card>
  );
}

export function KpiCard({ label, value, icon, tone = "neutral", hint, badge, trend, footer, onClick, className }: KpiCardProps) {
  return (
    <CardOrButton onClick={onClick} className={className}>
      <CardBody className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn(WORKSPACE_TYPOGRAPHY.kpiLabel, "truncate")}>{label}</span>
            {badge ?? null}
          </span>
          {icon ? (
            <span className="shrink-0 text-muted" aria-hidden="true">
              {icon}
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          <p className={cn(WORKSPACE_TYPOGRAPHY.kpiValue, TONE_TEXT[tone])}>{value}</p>
          {trend ?? null}
        </div>
        {hint ? <p className={WORKSPACE_TYPOGRAPHY.kpiHint}>{hint}</p> : null}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </CardBody>
    </CardOrButton>
  );
}

/**
 * The shared grid every KPI section uses — 2 columns on mobile, 4 on large
 * screens, identical gap everywhere (Dashboard, Personnel, Search, Gallery,
 * Review, Statistics, Media all compose this the same way).
 */
export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
