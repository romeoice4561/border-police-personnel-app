/**
 * OfficerDocumentReadinessCard (Phase 49A — §7).
 *
 * Compact document-readiness summary for the Officer Profile's sidebar
 * column (alongside OfficerIntelligenceCard/ProfileCompletenessCard) — a
 * high-level "is this officer's paperwork in order" glance, NOT a re-
 * implementation of the detailed e-PF dashboard further down the page.
 * Every value comes directly from the canonical
 * OfficerDocumentIntelligence contract (composed once, server-side, in
 * app/officers/[id]/page.tsx) — this component computes nothing.
 *
 * Clicking the card scrolls to the e-PF section (id="epf-section", added
 * to EpfSection's wrapper) rather than navigating away — the officer stays
 * on the same profile page, per spec §7 ("clicking the card opens or
 * scrolls to the e-PF section").
 */
"use client";

import { Check, AlertTriangle, Ban, HelpCircle, FileSearch } from "lucide-react";
import type { OfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { READINESS_LEVEL_TONE, COMPLETENESS_LEVEL_TONE } from "@/lib/integration/documents/readiness_tone";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";

const READINESS_ICON: Record<ReadinessLevel, typeof Check> = {
  READY: Check,
  NEEDS_REVIEW: FileSearch,
  INCOMPLETE: AlertTriangle,
  BLOCKED: Ban,
  UNKNOWN: HelpCircle,
};

export function OfficerDocumentReadinessCard({ documentIntelligence }: { documentIntelligence: OfficerDocumentIntelligence }) {
  const { t } = useT();
  const di = documentIntelligence;
  const ReadinessIcon = READINESS_ICON[di.readinessLevel];

  function scrollToEpf() {
    document.getElementById("epf-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.documentReadinessTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <button
          type="button"
          onClick={scrollToEpf}
          className="w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label={`${di.readinessLabelTh} — ${t("officer.documentReadinessViewEpf")}`}
        >
          <Badge tone={READINESS_LEVEL_TONE[di.readinessLevel]} className="inline-flex items-center gap-1.5">
            <ReadinessIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {di.readinessLabelTh}
          </Badge>
        </button>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{t("officer.documentReadinessCompleteness")}</span>
          <Badge tone={COMPLETENESS_LEVEL_TONE[di.completenessLevel]}>{di.completenessScore}%</Badge>
        </div>

        <div className="text-sm">
          <p className="text-muted">{t("officer.documentReadinessMissing")}</p>
          <p className="text-foreground">
            {di.missingRequiredCount > 0 ? di.missingRequiredDocuments.join(", ") : t("officer.documentReadinessMissingNone")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted">{t("officer.documentReadinessPendingReviews")}</p>
            <p className="tabular-nums text-foreground">{di.pendingReviewCount}</p>
          </div>
          <div>
            <p className="text-muted">{t("officer.documentReadinessQualityWarnings")}</p>
            <p className="tabular-nums text-foreground">{di.qualityWarningCount}</p>
          </div>
        </div>

        <div className="text-sm">
          <p className="text-muted">{t("officer.documentReadinessExpiry")}</p>
          {di.expiredCount === 0 && di.expiringSoonCount === 0 ? (
            <p className="text-foreground">{t("officer.documentReadinessNoExpiry")}</p>
          ) : (
            <p className="text-foreground">
              {di.expiredCount > 0 ? `${t("officer.documentReadinessExpired")}: ${di.expiredCount}` : null}
              {di.expiredCount > 0 && di.expiringSoonCount > 0 ? " · " : null}
              {di.expiringSoonCount > 0 ? `${t("officer.documentReadinessExpiringSoon")}: ${di.expiringSoonCount}` : null}
            </p>
          )}
        </div>

        {di.primaryAction !== "NONE" ? (
          <div className="border-t border-border pt-3 text-sm">
            <p className="text-muted">{t("officer.documentReadinessNextAction")}</p>
            <p className="font-medium text-foreground">{di.primaryActionLabelTh}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
