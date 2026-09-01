/**
 * Relationship Search results (Phase 1B.2.3) — search context + field-officer cards.
 * Semantics unchanged; presentation and returnTo continuity only.
 */
"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
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
  canViewFull,
}: {
  queryContext: DrugRelationshipSourceQueryContext | null;
  resolvedLabel: string;
  resolvedType: DrugGraphNodeType;
  relationLabel: string;
  canViewFull: boolean;
}) {
  const { t } = useT();
  const fromValue = presentSourceQueryDisplayValue(queryContext, canViewFull);
  const fromFieldKey = searchedFromFieldLabelKey(queryContext?.matchedField);
  const typeLabel = t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[resolvedType] as TranslationKey);

  return (
    <aside
      className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3"
      data-testid="relationship-search-context"
      aria-labelledby="rel-search-context-heading"
    >
      <h3 id="rel-search-context-heading" className="text-sm font-semibold text-foreground">
        🔎 {t("di.rel.searchContextHeading")}
      </h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div className="min-w-0 space-y-0.5">
          <dt className="text-xs font-medium text-muted">{t("di.rel.searchContextFrom")}</dt>
          <dd className="break-words text-foreground">
            {fromValue ? (
              <>
                <span className="font-medium">{t(fromFieldKey)}</span>
                <span className="text-muted">: </span>
                <span>{fromValue}</span>
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </dd>
        </div>
        <div className="min-w-0 space-y-0.5">
          <dt className="text-xs font-medium text-muted">{t("di.rel.searchContextResolved")}</dt>
          <dd className="break-words font-semibold text-foreground">
            {resolvedLabel}
            <span className="mt-0.5 block text-xs font-normal text-muted">{typeLabel}</span>
          </dd>
        </div>
        <div className="min-w-0 space-y-0.5">
          <dt className="text-xs font-medium text-muted">{t("di.rel.searchContextWanted")}</dt>
          <dd className="break-words text-foreground">{relationLabel}</dd>
        </div>
      </dl>
    </aside>
  );
}

export function DrugRelationshipSearchResults({
  data,
  returnPath,
  onExpand,
  queryContext,
  canViewFull,
  sourceLabel,
  sourceType,
  relationId,
}: {
  data: DrugRelationshipSearchResponse;
  returnPath: string;
  onExpand: (entity: { entityType: DrugGraphNodeType; entityId: string; label: string }) => void;
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

  return (
    <div className="space-y-4" data-testid="relationship-search-results">
      <SearchContextSummary
        queryContext={queryContext ?? null}
        resolvedLabel={resolvedLabel}
        resolvedType={resolvedType}
        relationLabel={relationLabel}
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
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">{t("di.rel.pathNotFound")}</p>
          <p className="text-xs text-muted">{t("di.rel.pathNotFoundHint")}</p>
        </div>
      ) : null}

      <div className="grid gap-3">
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

          return (
            <Card key={`${item.to.entityId}-${item.relationshipType ?? "path"}-${index}`}>
              <CardBody className="space-y-3" data-testid="relationship-result-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-muted">{ordinal}</p>
                    <p className="text-base font-semibold text-foreground break-words">{item.to.label}</p>
                    {item.to.secondaryLabel ? (
                      <p className="text-sm text-muted break-words">{item.to.secondaryLabel}</p>
                    ) : null}
                  </div>
                  <Badge kind={item.edgeKind} />
                </div>

                <div className="space-y-1 rounded-lg border border-border/70 bg-neutral-bg/40 px-3 py-2">
                  <p className="text-xs font-medium text-muted">{t("di.rel.whyFoundLabel")}</p>
                  <p className="text-sm text-foreground break-words">{why}</p>
                </div>

                <div className="space-y-1 text-sm text-muted">
                  <p className="text-xs font-medium text-muted">{t("di.rel.evidenceInSystem")}</p>
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
                    title={t("di.rel.expandHint")}
                    onClick={() => onExpand(item.actions.expandSource)}
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
