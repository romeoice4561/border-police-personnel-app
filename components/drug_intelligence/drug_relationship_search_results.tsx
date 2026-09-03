/**
 * Relationship Search results (Phase 1B.2.3 + visual entity language).
 * Semantics unchanged; presentation and returnTo continuity only.
 */
"use client";

import { ScanSearch } from "lucide-react";
import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  DRUG_EVIDENCE_SECTION_ICON,
  DRUG_RELATION_STEP_ICON,
  DrugEntityIconMark,
  searchedFromIcon,
} from "@/components/drug_intelligence/drug_entity_visual";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import {
  relationshipEvidenceText,
  relationshipWhyFoundText,
} from "@/lib/drug_intelligence/drug_relationship_result_card_copy";
import {
  formatRelationshipResultSummary,
  relationshipResultOrdinalKey,
} from "@/lib/drug_intelligence/drug_relationship_result_summary";
import {
  presentSourceQueryDisplayValue,
  searchedFromFieldLabelKey,
  type DrugRelationshipSourceQueryContext,
} from "@/lib/drug_intelligence/drug_relationship_search_context";
import { getControlledRelation } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import { withReturnTo } from "@/lib/ui/return_context";
import type {
  DrugRelationshipSearchResponse,
  DrugRelationshipSearchResultItem,
  DrugGraphNodeType,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function roleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  const labels = DRUG_CASE_PERSON_ROLE_LABELS[role];
  return language === "th" ? labels.labelTh : labels.labelEn;
}

function Badge({ kind }: { kind: DrugRelationshipSearchResultItem["edgeKind"] }) {
  const { t } = useT();
  if (kind === "INFERRED") {
    return (
      <span
        className="inline-flex items-center rounded-full border border-amber-700/40 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        title={t("di.rel.badgeInferredHint")}
      >
        {t("di.rel.badgeInferred")}
      </span>
    );
  }
  if (kind === "PATH") {
    return (
      <span
        className="inline-flex items-center rounded-full border border-border bg-neutral-bg px-2.5 py-0.5 text-xs font-medium text-foreground"
        title={t("di.rel.badgePathHint")}
      >
        {t("di.rel.badgePath")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full border border-emerald-700/40 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
      title={t("di.rel.badgeDirectHint")}
    >
      {t("di.rel.badgeDirect")}
    </span>
  );
}

function SearchContextSummary({
  queryContext,
  resolvedLabel,
  resolvedType,
  relationLabel,
  wantedType,
  canViewFull,
}: {
  queryContext: DrugRelationshipSourceQueryContext | null;
  resolvedLabel: string;
  resolvedType: DrugGraphNodeType;
  relationLabel: string;
  wantedType?: DrugGraphNodeType;
  canViewFull: boolean;
}) {
  const { t } = useT();
  const fromValue = presentSourceQueryDisplayValue(queryContext, canViewFull);
  const fromFieldKey = searchedFromFieldLabelKey(queryContext?.matchedField);
  const typeLabel = t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[resolvedType] as TranslationKey);
  const wantedTypeLabel = wantedType
    ? t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[wantedType] as TranslationKey)
    : null;
  const FromIcon = searchedFromIcon(queryContext?.matchedField);

  return (
    <aside
      className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-sm"
      data-testid="relationship-search-context"
      aria-labelledby="rel-search-context-heading"
    >
      <h3
        id="rel-search-context-heading"
        className="flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <ScanSearch className="h-4 w-4 text-accent" aria-hidden="true" />
        {t("di.rel.searchContextHeading")}
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-border/80 bg-neutral-bg/35 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t("di.rel.searchContextFrom")}
          </dt>
          <dd className="mt-2 flex items-start gap-2.5">
            <DrugEntityIconMark icon={FromIcon} size="md" />
            <div className="min-w-0 space-y-0.5">
              {fromValue ? (
                <>
                  <p className="text-xs font-semibold text-foreground">{t(fromFieldKey)}</p>
                  <p className="break-words text-sm text-foreground">{fromValue}</p>
                </>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </div>
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border border-border/80 bg-neutral-bg/35 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t("di.rel.searchContextResolved")}
          </dt>
          <dd className="mt-2 flex items-start gap-2.5">
            <DrugEntityIconMark type={resolvedType} size="md" />
            <div className="min-w-0 space-y-0.5">
              <p className="break-words text-sm font-semibold text-foreground">{resolvedLabel}</p>
              <p className="text-xs text-muted">{typeLabel}</p>
            </div>
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border border-border/80 bg-neutral-bg/35 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t("di.rel.searchContextWanted")}
          </dt>
          <dd className="mt-2 flex items-start gap-2.5">
            <DrugEntityIconMark type={wantedType ?? "CASE"} size="md" />
            <div className="min-w-0 space-y-0.5">
              {wantedTypeLabel ? (
                <p className="text-sm font-semibold text-foreground">{wantedTypeLabel}</p>
              ) : null}
              <p className="break-words text-xs text-muted">{relationLabel}</p>
            </div>
          </dd>
        </div>
      </dl>
    </aside>
  );
}

export function DrugRelationshipSearchResults({
  data,
  returnPath,
  onExpand,
  expandDisabled = false,
  queryContext,
  canViewFull,
  sourceLabel,
  sourceType,
  relationId,
}: {
  data: DrugRelationshipSearchResponse;
  returnPath: string;
  onExpand: (payload: {
    entityType: DrugGraphNodeType;
    entityId: string;
    label: string;
    edgeKind: DrugRelationshipSearchResultItem["edgeKind"];
    evidenceSummary: string;
  }) => void;
  expandDisabled?: boolean;
  queryContext?: DrugRelationshipSourceQueryContext | null;
  canViewFull?: boolean;
  sourceLabel?: string;
  sourceType?: DrugGraphNodeType;
  relationId?: string;
}) {
  const { t, language } = useT();
  const lang = language === "th" ? "th" : "en";
  const relation = relationId ? getControlledRelation(relationId) : null;
  const targetType = (data.interpretation.target.entityType ??
    Object.keys(data.summary.byTargetType)[0]) as DrugGraphNodeType | undefined;
  const summaryText = formatRelationshipResultSummary({
    count: data.summary.total,
    relation,
    targetType,
    sourceType,
    sourceLabel,
    t,
    locale: lang === "th" ? "th-TH" : "en-US",
  });
  const relationLabel = relation ? t(relation.labelKey) : t("di.rel.relationSection");
  const resolvedLabel = sourceLabel || data.results[0]?.from.label || "—";
  const resolvedType = sourceType || data.interpretation.source.entityType;
  const WhyIcon = DRUG_RELATION_STEP_ICON;
  const EvidenceIcon = DRUG_EVIDENCE_SECTION_ICON;

  return (
    <div className="space-y-4" data-testid="relationship-search-results">
      <SearchContextSummary
        queryContext={queryContext ?? null}
        resolvedLabel={resolvedLabel}
        resolvedType={resolvedType}
        relationLabel={relationLabel}
        wantedType={targetType}
        canViewFull={Boolean(canViewFull)}
      />

      <div className="space-y-1" data-testid="relationship-result-summary">
        <h2 className="text-base font-semibold text-foreground">{t("di.rel.resultsHeading")}</h2>
        <p className="text-sm font-medium text-foreground" aria-live="polite">
          {summaryText}
        </p>
        {data.truncated ? <p className="text-xs text-amber-800 dark:text-amber-200">{t("di.rel.truncatedNotice")}</p> : null}
      </div>

      {!data.summary.found ? (
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground">{t("di.rel.pathNotFound")}</p>
          <p className="text-xs text-muted">{t("di.rel.pathNotFoundHint")}</p>
        </div>
      ) : null}

      <div className="grid gap-3.5">
        {data.results.map((item, index) => {
          const ordinal = t(relationshipResultOrdinalKey(item.to.entityType)).replace(
            "{n}",
            String(index + 1)
          );
          const why = relationshipWhyFoundText(item, lang, (role) => roleLabel(role, lang), t);
          const evidence = relationshipEvidenceText(item, lang, (role) => roleLabel(role, lang), t);
          const networkHref = withReturnTo(`${item.actions.networkPath}&depth=2`, returnPath);
          const detailHref = item.actions.detailPath
            ? withReturnTo(item.actions.detailPath, returnPath)
            : null;
          const primaryIsDetail = Boolean(detailHref);
          const resultTypeLabel = t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[item.to.entityType] as TranslationKey);
          const relatedFromLabel = item.from.label || resolvedLabel;

          return (
            <Card
              key={`${item.to.entityId}-${item.relationshipType ?? "path"}-${index}`}
              className="border-border shadow-sm"
            >
              <CardBody className="space-y-3" data-testid="relationship-result-card" data-entity-type={item.to.entityType}>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 pb-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <DrugEntityIconMark type={item.to.entityType} size="lg" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {resultTypeLabel}
                        <span className="mx-1 text-border">·</span>
                        {ordinal}
                      </p>
                      <p className="text-base font-semibold text-foreground break-words">{item.to.label}</p>
                      {item.to.secondaryLabel ? (
                        <p className="text-sm text-muted break-words">{item.to.secondaryLabel}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge kind={item.edgeKind} />
                </div>

                {relatedFromLabel ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-neutral-bg/30 px-3 py-2">
                    <DrugEntityIconMark type={item.from.entityType || resolvedType} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted">{t("di.rel.relatedToSource")}</p>
                      <p className="text-sm font-medium text-foreground break-words">{relatedFromLabel}</p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1 rounded-lg border border-border/70 bg-neutral-bg/40 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <WhyIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t("di.rel.whyFoundLabel")}
                  </p>
                  <p className="text-sm text-foreground break-words">{why}</p>
                </div>

                <div className="space-y-1 text-sm text-muted">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <EvidenceIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t("di.rel.evidenceInSystem")}
                  </p>
                  <p className="text-foreground">{evidence}</p>
                  {item.sourceCaseIds.length > 0 ? (
                    <p className="text-xs">{t("di.rel.relatedCasesCount").replace("{count}", String(item.sourceCaseIds.length))}</p>
                  ) : null}
                  {item.pathSteps && item.pathSteps.length > 0 ? (
                    <ol className="list-decimal space-y-0.5 pl-4 text-xs">
                      {item.pathSteps.map((step, i) => (
                        <li key={`${step.entity.entityId}-${i}`}>
                          {step.entity.label}
                          {step.viaRelationshipType ? ` (${step.viaRelationshipType})` : ""}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {primaryIsDetail ? (
                    <Button asChild variant="accent" size="sm" className="min-h-10">
                      <Link href={detailHref!}>{t("di.rel.viewDetail")}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="accent" size="sm" className="min-h-10">
                      <Link href={networkHref}>{t("di.rel.openNetwork")}</Link>
                    </Button>
                  )}
                  {primaryIsDetail ? (
                    <Button asChild variant="outline" size="sm" className="min-h-10">
                      <Link href={networkHref}>{t("di.rel.openNetwork")}</Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    title={
                      expandDisabled ? t("di.rel.expandDisabledLimit") : t("di.rel.expandHint")
                    }
                    disabled={expandDisabled}
                    data-testid="rel-expand-result"
                    onClick={() =>
                      onExpand({
                        ...item.actions.expandSource,
                        edgeKind: item.edgeKind,
                        evidenceSummary: evidence,
                      })
                    }
                  >
                    {t("di.rel.expand")}
                  </Button>
                  {item.actions.timelinePath ? (
                    <Button asChild variant="ghost" size="sm" className="min-h-10">
                      <Link href={withReturnTo(item.actions.timelinePath, returnPath)}>{t("di.rel.viewTimeline")}</Link>
                    </Button>
                  ) : null}
                  {item.actions.mapPath ? (
                    <Button asChild variant="ghost" size="sm" className="min-h-10">
                      <Link href={withReturnTo(item.actions.mapPath, returnPath)}>{t("di.rel.viewMap")}</Link>
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
