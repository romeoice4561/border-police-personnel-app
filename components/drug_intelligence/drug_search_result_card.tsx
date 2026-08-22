/**
 * DrugSearchResultCard (Phase DI-3 — Sections 11, 18, 20).
 *
 * One card per search result, entity-type-aware. Always shows the match
 * explanation (Section 18 — never a bare unexplained relevance number) and
 * links into the correct drill-down destination per entity type (Section
 * 11's action list). A MERGED person result shows a small note instead of
 * an action, per Section 20 — never presented as an independent active
 * profile.
 */
"use client";

import Link from "next/link";
import { AlertTriangle, Network } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_SEARCH_MATCHED_FIELD_LABEL_KEY } from "@/lib/drug_intelligence/drug_search_match_explanation";
import { drugEntityDetailPath, drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import type { DrugSearchResult } from "@/lib/drug_intelligence/drug_intelligence_client";

const STRENGTH_TONE = { EXACT: "critical", PARTIAL: "neutral" } as const;

function entityHref(result: DrugSearchResult): string {
  return drugEntityDetailPath(result.entityType, result.canonicalTarget?.entityId ?? result.entityId);
}

function actionLabelKey(entityType: DrugSearchResult["entityType"]): "di.search.viewProfile" | "di.search.viewRelations" | "di.search.openCase" {
  if (entityType === "PERSON") return "di.search.viewProfile";
  if (entityType === "CASE") return "di.search.openCase";
  return "di.search.viewRelations";
}

export function DrugSearchResultCard({ result }: { result: DrugSearchResult }) {
  const { t, language } = useT();
  const matchLabel = t(DRUG_SEARCH_MATCHED_FIELD_LABEL_KEY[result.matchedField]);

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{result.primaryLabel}</p>
            {result.secondaryLabel ? <p className="truncate text-sm text-muted">{result.secondaryLabel}</p> : null}
          </div>
          <Badge tone={STRENGTH_TONE[result.strength]}>{matchLabel}</Badge>
        </div>

        {result.entityType === "CASE" ? null : (
          <p className="text-xs text-muted">
            {result.caseCount > 0 ? `${result.caseCount} ${t("di.person.casesInvolved")}` : null}
            {result.lastSeen ? ` · ${t("di.profile.lastSeen")}: ${new Date(result.lastSeen).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}` : null}
          </p>
        )}

        {result.hasPotentialDuplicate ? (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("di.search.duplicateWarning")}
          </p>
        ) : null}

        {result.canonicalTarget ? (
          <p className="text-xs text-muted">{t("di.search.mergedNotice")}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={entityHref(result)}>{t(actionLabelKey(result.entityType))}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={drugNetworkFocusPath(result.entityType, result.canonicalTarget?.entityId ?? result.entityId)}>
              <Network className="h-4 w-4" aria-hidden="true" />
              {t("di.network.openNetwork")}
            </Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
