/**
 * EpfDocumentIntelligenceSummary (Phase 49A — §8).
 *
 * A NEW, distinct top strip surfacing the canonical
 * OfficerDocumentIntelligence contract (readiness level, pending reviews,
 * unsupported documents, quality warnings, recommended next action) — kept
 * separate from EpfHeroSummary (which already owns completion %/document
 * count/storage/last-updated, Phase 46C's "each metric appears only once"
 * rule) and from EpfExpiryDashboard (which already owns the detailed
 * expired/expiring breakdown). This card shows ONLY what those two don't:
 * the Phase 48C readiness verdict itself, review/quality-warning counts,
 * and — per spec §12 — an explicit source-indicator distinguishing
 * persisted document data from session-local (in-memory, lost on server
 * restart) OCR/AI intelligence.
 *
 * All values come directly from the composed contract — no calculation here.
 */
"use client";

import { Check, AlertTriangle, Ban, HelpCircle, FileSearch } from "lucide-react";
import type { OfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { READINESS_LEVEL_TONE } from "@/lib/integration/documents/readiness_tone";
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";

const READINESS_ICON: Record<ReadinessLevel, typeof Check> = {
  READY: Check,
  NEEDS_REVIEW: FileSearch,
  INCOMPLETE: AlertTriangle,
  BLOCKED: Ban,
  UNKNOWN: HelpCircle,
};

export function EpfDocumentIntelligenceSummary({
  documentIntelligence,
  /** True when the caller actually has a live, current-session OCR/AI review-status map for this officer's documents (i.e. extraction was run this session) — controls which source-indicator label renders. False/omitted (the common case after a server restart, or before any extraction has run) shows the persisted-data-only label, never implying transient OCR state survived. */
  hasSessionOcrData = false,
}: {
  documentIntelligence: OfficerDocumentIntelligence;
  hasSessionOcrData?: boolean;
}) {
  const { t } = useT();
  const di = documentIntelligence;
  const ReadinessIcon = READINESS_ICON[di.readinessLevel];

  return (
    <div className="rounded-2xl border border-border bg-neutral-bg p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("epf.intelligence.title")}</p>
        <span className="text-xs text-muted">
          {hasSessionOcrData ? t("epf.intelligence.sourceSession") : t("epf.intelligence.sourcePersisted")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={READINESS_LEVEL_TONE[di.readinessLevel]} className="inline-flex items-center gap-1.5">
          <ReadinessIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {di.readinessLabelTh}
        </Badge>
        {di.primaryAction !== "NONE" ? <span className="text-sm text-foreground">{di.primaryActionLabelTh}</span> : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">{t("epf.intelligence.pendingReview")}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{di.pendingReviewCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("epf.intelligence.unsupported")}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{di.unsupportedCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("epf.intelligence.qualityWarnings")}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{di.qualityWarningCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("epf.intelligence.missingRequired")}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{di.missingRequiredCount}</dd>
        </div>
      </dl>

      {!hasSessionOcrData ? <p className="mt-3 text-xs text-muted">{t("epf.intelligence.noOcrYet")}</p> : null}
    </div>
  );
}
