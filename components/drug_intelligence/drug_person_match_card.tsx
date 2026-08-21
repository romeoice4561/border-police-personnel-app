/**
 * DrugPersonMatchCard (Phase DI-2 Round B — Section 22).
 *
 * Reusable "potential duplicate" candidate card, used by both Create Case's
 * person step (Section 21/28) and the Duplicate Review Queue. Always shows
 * name, confidence, and backend-computed match reasons via
 * DrugMatchSignalsList — never a bare name-only warning, matching Section
 * 11's "match explanation" requirement.
 */
"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DrugMatchConfidenceBadge } from "@/components/drug_intelligence/drug_match_confidence_badge";
import { DrugMatchSignalsList } from "@/components/drug_intelligence/drug_match_signals_list";
import { presentIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import type { DrugPersonMatchCandidate } from "@/lib/drug_intelligence/drug_intelligence_client";

export function DrugPersonMatchCard({
  candidate,
  onUseExisting,
  /** When true (default), a "ดูโปรไฟล์" link opens the person's profile in a new tab — never navigates away from an in-progress form (e.g. Create Case). */
  showViewProfileLink = true,
}: {
  candidate: DrugPersonMatchCandidate;
  onUseExisting?: () => void;
  showViewProfileLink?: boolean;
}) {
  const { t } = useT();
  const { can } = useAuth();
  const canViewFull = can("drug.edit");

  const identifierSignal = candidate.signals.find((s) => s.kind.startsWith("IDENTIFIER_"));

  return (
    <Card className="border-serious/40 bg-serious/5">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-foreground">{candidate.primaryFullName}</p>
          <DrugMatchConfidenceBadge confidence={candidate.confidence} />
        </div>

        {identifierSignal ? (
          <p className="font-mono text-xs text-muted">{presentIdentifierValue(identifierSignal.matchedValue, canViewFull)}</p>
        ) : null}

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.matchReasons")}</p>
          <DrugMatchSignalsList signals={candidate.signals} confidence={candidate.confidence} />
        </div>

        <div className="flex flex-wrap gap-2">
          {onUseExisting ? (
            <Button type="button" variant="outline" size="sm" onClick={onUseExisting}>
              {t("di.person.useExisting")}
            </Button>
          ) : null}
          {showViewProfileLink ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/drug-intelligence/persons/${encodeURIComponent(candidate.personId)}`} target="_blank" rel="noopener noreferrer">
                {t("di.person.viewProfile")}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
