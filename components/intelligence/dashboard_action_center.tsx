/**
 * DashboardActionCenter (Phase 42 — Commander Dashboard Intelligence).
 *
 * Renders the Action Center — a small, consolidated list of urgent items
 * built by lib/commander_dashboard/view_model.ts's buildActionCenter. This
 * component only renders already-computed CommanderActionItemViewModel
 * entries; it does not calculate severity, counts, or hrefs itself.
 */
"use client";

import Link from "next/link";
import { AlertTriangle, Cake, GraduationCap, Info, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { CommanderActionItemViewModel, CommanderActionSeverity } from "@/lib/commander_dashboard/types";

const SEVERITY_TONE: Record<CommanderActionSeverity, "critical" | "warning" | "accent"> = {
  high: "critical",
  medium: "warning",
  info: "accent",
};

/** Static class strings per severity — Tailwind's JIT compiler cannot see dynamically-built `bg-${tone}-bg` template strings, so each combination is spelled out. */
const SEVERITY_ICON_WRAP: Record<CommanderActionSeverity, string> = {
  high: "bg-critical-bg text-critical",
  medium: "bg-warning-bg text-warning",
  info: "bg-accent/10 text-accent",
};

const CATEGORY_ICON: Record<CommanderActionItemViewModel["category"], typeof AlertTriangle> = {
  PROMOTION_PRIORITY: TrendingUp,
  RETIREMENT: AlertTriangle,
  DATA_QUALITY: Info,
  BIRTHDAY: Cake,
  TRAINING: GraduationCap,
  DOCUMENT_EXPIRY_FUTURE: Info,
};

function ActionRow({ item }: { item: CommanderActionItemViewModel }) {
  const Icon = CATEGORY_ICON[item.category];
  const body = (
    // Phase 42 UI refinement (Task 1): the description previously read as
    // clipped in a narrow/cramped row — widened the row's effective content
    // area (px-4 -> px-5, py-3 -> py-4, gap-3 -> gap-3.5), moved the count
    // badge onto its OWN line so it never competes with the title for
    // horizontal space, and gave the description an explicit `wrap-break-word`
    // + relaxed line-height so it always wraps to as many lines as it needs
    // — never truncated, never an ellipsis, for commander-facing text.
    <div className="flex items-start gap-3.5 px-5 py-4">
      <span className={cn("mt-0.5 shrink-0 rounded-full p-1.5", SEVERITY_ICON_WRAP[item.severity])} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="wrap-break-word text-sm font-medium text-foreground">{item.title}</p>
          <Badge tone={SEVERITY_TONE[item.severity]} className="shrink-0">
            {item.count.toLocaleString()}
          </Badge>
        </div>
        <p className="wrap-break-word text-xs leading-relaxed text-muted">{item.description}</p>
      </div>
    </div>
  );

  if (!item.href) return <div className="border-b border-border last:border-b-0">{body}</div>;
  return (
    <Link
      href={item.href}
      className="block border-b border-border transition-colors last:border-b-0 hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
    >
      {body}
    </Link>
  );
}

export function DashboardActionCenter({ items }: { items: CommanderActionItemViewModel[] }) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.actionCenterTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{t("dashboard.actionCenterEmpty")}</p>
        ) : (
          <div>
            {items.map((item) => (
              <ActionRow key={item.id} item={item} />
            ))}
          </div>
        )}
        {/*
          Phase 42 Task 8 — Document & Expiry Intelligence is a reserved
          FUTURE integration point (full implementation is Phase 46; see
          docs/COMMANDER_DASHBOARD_INTELLIGENCE.md and
          docs/INTELLIGENCE_ROADMAP.md). No document-expiry data model or
          engine exists yet, so this line is disabled/inert — matching the
          existing "coming soon" convention already used elsewhere on
          Commander Search (the disabled Excel/PDF/CSV export buttons in
          commander_query_center.tsx) — and shows NO count, since inventing
          one would violate the "no fabricated data" rule.
        */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-muted opacity-60">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-xs">{t("dashboard.documentExpiryComingSoon")}</p>
        </div>
      </CardBody>
    </Card>
  );
}
