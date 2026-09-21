/**
 * DrugSearchResultCard (Phase DI-3 — Sections 11, 18, 20 + DI-8.3 Relationship prefill).
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
import { AlertTriangle, Link2, Network } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_SEARCH_MATCHED_FIELD_LABEL_KEY } from "@/lib/drug_intelligence/drug_search_match_explanation";
import { drugEntityDetailPath, drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import type { DrugSearchResult } from "@/lib/drug_intelligence/drug_intelligence_client";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { formatThaiOperationalDate } from "@/lib/drug_intelligence/di_date_helpers";

const STRENGTH_TONE = { EXACT: "critical", PARTIAL: "neutral" } as const;

const ALL_RELATED_BY_TYPE: Record<DrugSearchResult["entityType"], string> = {
  PERSON: "person_all_related",
  PHONE: "phone_all_related",
  SIM: "sim_all_related",
  DEVICE: "device_all_related",
  VEHICLE: "vehicle_all_related",
  CASE: "case_all_related",
};

function entityHref(result: DrugSearchResult): string {
  return drugEntityDetailPath(result.entityType, result.canonicalTarget?.entityId ?? result.entityId);
}

function relationshipSearchHref(result: DrugSearchResult): string {
  const entityId = result.canonicalTarget?.entityId ?? result.entityId;
  const params = new URLSearchParams({
    mode: "relationship",
    relSourceType: result.entityType,
    relSourceId: entityId,
    relSourceLabel: result.primaryLabel,
    relationId: ALL_RELATED_BY_TYPE[result.entityType],
  });
  return `/drug-intelligence/search?${params.toString()}`;
}

function actionLabelKey(entityType: DrugSearchResult["entityType"]): "di.search.viewProfile" | "di.search.viewRelations" | "di.search.openCase" {
  if (entityType === "PERSON") return "di.search.viewProfile";
  if (entityType === "CASE") return "di.search.openCase";
  return "di.search.viewRelations";
}

export function DrugSearchResultCard({ result }: { result: DrugSearchResult }) {
  const { t } = useT();
  const matchLabel = t(DRUG_SEARCH_MATCHED_FIELD_LABEL_KEY[result.matchedField]);
  const relHref = relationshipSearchHref(result);

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <DrugEntityVisualThumb
              entityType={result.entityType}
              label={result.primaryLabel}
              thumbnailUrl={result.visual?.thumbnailUrl}
              size={result.entityType === "PERSON" || result.entityType === "VEHICLE" ? "search" : "sm"}
            />
            <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{result.primaryLabel}</p>
            {result.secondaryLabel ? <p className="truncate text-sm text-muted">{result.secondaryLabel}</p> : null}
            </div>
          </div>
          <Badge tone={STRENGTH_TONE[result.strength]}>{matchLabel}</Badge>
        </div>

        {result.entityType === "CASE" ? null : (
          <p className="text-xs text-muted">
            {result.caseCount > 0 ? `${result.caseCount} ${t("di.person.casesInvolved")}` : null}
            {result.caseCount >= 2 ? (
              <>
                {" · "}
                <span className="text-foreground">{t("di.search.multiCaseHint")}</span>
                {" · "}
                <Link href={relHref} className="text-accent hover:underline" data-testid="search-view-relationships">
                  {t("di.connection.viewConnections")}
                </Link>
              </>
            ) : result.caseCount === 1 ? (
              <>
                {" · "}
                <Link href={relHref} className="text-accent hover:underline" data-testid="search-view-relationships">
                  {t("di.connection.viewConnections")}
                </Link>
              </>
            ) : null}
            {result.lastSeen ? ` · ${t("di.profile.lastSeen")}: ${formatThaiOperationalDate(result.lastSeen)}` : null}
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
          <Button asChild variant="outline" size="sm" data-testid="search-open-relationship">
            <Link href={relHref}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {t("di.connection.viewConnections")}
            </Link>
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
