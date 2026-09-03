/**
 * Commander data-readiness panel (Phase 2D). Counts and percentages only.
 */
"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { commanderReadinessPercent } from "@/lib/drug_intelligence/drug_commander_comparison";

export interface CommanderReadinessRow {
  id: string;
  label: string;
  count: number;
  href: string;
}

interface Props {
  totalCases: number;
  rows: CommanderReadinessRow[];
}

function formatPercent(part: number, total: number): string {
  const pct = commanderReadinessPercent(part, total);
  if (pct === null) return "—";
  return `${pct.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

export function CommanderReadinessSection({ totalCases, rows }: Props) {
  const { t } = useT();

  return (
    <section aria-labelledby="readiness-heading" data-testid="commander-data-readiness">
      <CardHeader className="mb-2 px-0">
        <CardTitle id="readiness-heading">{t("di.command.readinessTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-4 text-xs text-muted">{t("di.command.readinessNote")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/50 hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block text-2xl font-bold tabular-nums text-foreground">
              {row.count.toLocaleString("th-TH")}
            </span>
            <span className="mt-1 block text-sm text-foreground">{row.label}</span>
            <span className="mt-1 block text-xs text-muted">
              {formatPercent(row.count, totalCases)} {t("di.command.readinessOfPeriod")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
