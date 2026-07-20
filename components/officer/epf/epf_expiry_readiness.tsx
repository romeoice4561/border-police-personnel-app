/**
 * EpfExpiryReadiness (Phase 47 — "Document Readiness Summary", spec §10).
 *
 * A single derived sentence summarizing expiry readiness, built purely from
 * lib/document/document_expiry.ts's ExpirySummary — no new persistence, no
 * new calculation (just picks which pre-computed sentence to show).
 */
"use client";

import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { ExpirySummary } from "@/lib/document/document_expiry";
import { useT } from "@/components/i18n/language_provider";

export function EpfExpiryReadiness({ summary }: { summary: ExpirySummary }) {
  const { t } = useT();

  if (summary.totalTracked === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {t("epf.expiry.readinessNoneTracked")}
      </p>
    );
  }

  if (summary.expiredCount === 0 && summary.expiringSoonCount === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-good">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {t("epf.expiry.readinessAllValid")}
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-foreground">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
      {summary.expiringSoonCount > 0 ? (
        <span>
          {summary.expiringSoonCount} {t("epf.expiry.readinessNeedsRenewal")}
        </span>
      ) : null}
      {summary.expiredCount > 0 ? (
        <span>
          {summary.expiredCount} {t("epf.expiry.readinessExpired")}
        </span>
      ) : null}
    </p>
  );
}
