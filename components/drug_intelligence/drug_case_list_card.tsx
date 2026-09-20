/**
 * Compact operational Case List row — scan hierarchy for officers/commanders.
 * Display-only; reuses existing list row fields (no new API).
 */
"use client";

import Link from "next/link";
import { FolderOpen, Users, Package, ChevronRight } from "lucide-react";
import { DrugCaseStatusBadge } from "@/components/drug_intelligence/drug_case_status_badge";
import { useT } from "@/components/i18n/language_provider";
import { toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugCaseListRow } from "@/lib/drug_intelligence/drug_intelligence_client";
import { cn } from "@/lib/ui/cn";

export function DrugCaseListCard({ row, className }: { row: DrugCaseListRow; className?: string }) {
  const { t } = useT();
  const href = `/drug-intelligence/cases/${encodeURIComponent(row.id)}`;
  const arrest = row.arrestDate ? toGregorianDateInputValue(row.arrestDate) : "—";
  const unit = row.reportingUnitText || row.leadUnitText || "—";

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors",
        "hover:border-accent/50 hover:bg-neutral-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      data-testid="case-list-card"
      data-case-id={row.id}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-hidden="true">
          <FolderOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{row.caseNumber}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted">{row.title || "—"}</p>
            </div>
            <DrugCaseStatusBadge status={row.status} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md border border-border bg-neutral-bg/60 px-1.5 py-0.5 text-foreground">{arrest}</span>
            {row.province ? (
              <span className="rounded-md border border-border bg-neutral-bg/60 px-1.5 py-0.5 text-foreground">{row.province}</span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-neutral-bg/60 px-1.5 py-0.5 text-foreground">
              <Users className="h-3 w-3 text-muted" aria-hidden="true" />
              {row.personCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-neutral-bg/60 px-1.5 py-0.5 text-foreground">
              <Package className="h-3 w-3 text-muted" aria-hidden="true" />
              {row.seizedItemCount}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-muted" title={unit}>
              {unit}
            </p>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-accent group-hover:underline">
              {t("di.list.openCase")}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>

          {row.seizedItemsSummary ? (
            <p className="line-clamp-1 text-[11px] text-muted" title={row.seizedItemsSummary}>
              {row.seizedItemsSummary}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
