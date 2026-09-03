/**
 * CommanderKpiCard (Phase 2B).
 *
 * Enhanced KPI card for the Commander Dashboard — larger value text,
 * description below value, fiscal year context, drill-down link.
 * More prominent than DrugKpiTile (which this does NOT replace — that
 * component is still used on the landing page).
 */
"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";

interface CommanderKpiCardProps {
  label: string;
  value: number | string;
  description?: string;
  subtitle?: string;
  footnote?: string;
  icon: LucideIcon;
  href?: string;
  loading?: boolean;
  error?: boolean;
  className?: string;
}

export function CommanderKpiCard({
  label,
  value,
  description,
  subtitle,
  footnote,
  icon: Icon,
  href,
  loading,
  error,
  className,
}: CommanderKpiCardProps) {
  const content = (
    <Card
      className={cn(
        "flex flex-col gap-2 p-5 transition-colors",
        (href) && "hover:border-accent/50 hover:bg-neutral-bg cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {subtitle && (
          <span className="text-xs text-muted bg-neutral-bg px-2 py-0.5 rounded-full">{subtitle}</span>
        )}
      </div>
      <div>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-neutral-bg" />
        ) : error ? (
          <span className="block text-sm font-medium text-critical">—</span>
        ) : (
          <span className="block text-3xl font-bold tabular-nums text-foreground">
            {typeof value === "number" ? value.toLocaleString("th-TH") : value}
          </span>
        )}
        <span className="block text-sm font-medium text-foreground mt-0.5">{label}</span>
        {description && (
          <span className="block text-xs text-muted mt-1">{description}</span>
        )}
        {footnote && (
          <span className="block text-xs text-muted mt-2 leading-snug">{footnote}</span>
        )}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
      >
        {content}
      </Link>
    );
  }
  return content;
}
