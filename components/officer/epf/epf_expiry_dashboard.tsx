/**
 * EpfExpiryDashboard (Phase 47 — Document Expiry Intelligence).
 *
 * The "Document Expiry Intelligence" section — KPI cards for Expiring Soon /
 * Expired / Unknown Expiry / Healthy, all read from
 * lib/document/document_expiry.ts's summary() over documents already loaded
 * on the page. Cards are clickable and scroll to the matching timeline
 * section when there's something to show.
 */
"use client";

import { AlertTriangle, XCircle, HelpCircle, ShieldCheck } from "lucide-react";
import type { ExpirySummary } from "@/lib/document/document_expiry";
import { useT } from "@/components/i18n/language_provider";

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "warning" | "serious" | "neutral" | "good";
  onClick?: () => void;
}) {
  const toneCls = {
    warning: "text-warning",
    serious: "text-serious",
    neutral: "text-muted",
    good: "text-good",
  }[tone];

  const content = (
    <>
      <div className="flex items-center gap-2 text-muted">
        <Icon className={`h-4 w-4 ${toneCls}`} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-4"
      >
        {content}
      </button>
    );
  }

  return <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">{content}</div>;
}

export function EpfExpiryDashboard({ summary, onJumpToTimeline }: { summary: ExpirySummary; onJumpToTimeline?: () => void }) {
  const { t } = useT();

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t("epf.expiry.sectionTitle")}</h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <KpiCard
          icon={AlertTriangle}
          label={t("epf.expiry.expiringSoon")}
          value={summary.expiringSoonCount}
          tone="warning"
          onClick={summary.expiringSoonCount > 0 ? onJumpToTimeline : undefined}
        />
        <KpiCard
          icon={XCircle}
          label={t("epf.expiry.expired")}
          value={summary.expiredCount}
          tone="serious"
          onClick={summary.expiredCount > 0 ? onJumpToTimeline : undefined}
        />
        <KpiCard
          icon={HelpCircle}
          label={t("epf.expiry.unknownExpiry")}
          value={summary.unknownCount}
          tone="neutral"
          onClick={summary.unknownCount > 0 ? onJumpToTimeline : undefined}
        />
        <KpiCard icon={ShieldCheck} label={t("epf.expiry.healthy")} value={summary.validCount} tone="good" />
      </div>
    </div>
  );
}
