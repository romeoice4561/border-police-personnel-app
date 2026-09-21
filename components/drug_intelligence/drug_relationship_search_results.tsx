/**
 * Relationship Search results (Phase 1B.2.3 + DI-8.3 compact intelligence rows).
 * Semantics unchanged; presentation density and returnTo continuity only.
 */
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import {
  DRUG_EVIDENCE_SECTION_ICON,
  DRUG_RELATION_STEP_ICON,
  DrugEntityIconMark,
  searchedFromIcon,
} from "@/components/drug_intelligence/drug_entity_visual";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import {
  relationshipCompactWhyText,
  relationshipEvidenceText,
  relationshipWhyFoundText,
} from "@/lib/drug_intelligence/drug_relationship_result_card_copy";
import {
  presentSourceQueryDisplayValue,
  searchedFromFieldLabelKey,
  type DrugRelationshipSourceQueryContext,
} from "@/lib/drug_intelligence/drug_relationship_search_context";
import { getControlledRelation } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import { formatThaiOperationalDate, formatThaiOperationalDateWithClock } from "@/lib/drug_intelligence/di_date_helpers";
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
        className="inline-flex items-center rounded-full border border-amber-700/40 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        title={t("di.rel.badgeInferredHint")}
        data-testid="rel-badge-inferred"
      >
        {t("di.rel.badgeInferred")}
      </span>
    );
  }
  if (kind === "PATH") {
    return (
      <span
        className="inline-flex items-center rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-foreground"
        title={t("di.rel.badgePathHint")}
        data-testid="rel-badge-path"
      >
        {t("di.rel.badgePath")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full border border-emerald-700/40 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
      title={t("di.rel.badgeDirectHint")}
      data-testid="rel-badge-direct"
    >
      {t("di.rel.badgeDirect")}
    </span>
  );
}

const GROUP_ORDER: DrugGraphNodeType[] = ["CASE", "PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "LOCATION"];

const ALL_RELATED_BY_TYPE: Partial<Record<DrugGraphNodeType, string>> = {
  PERSON: "person_all_related",
  PHONE: "phone_all_related",
  SIM: "sim_all_related",
  DEVICE: "device_all_related",
  VEHICLE: "vehicle_all_related",
  CASE: "case_all_related",
};

function sectionTitleKey(type: DrugGraphNodeType): TranslationKey {
  if (type === "CASE") return "di.rel.sectionCases";
  if (type === "PERSON") return "di.rel.sectionPersons";
  if (type === "PHONE") return "di.rel.sectionPhones";
  if (type === "SIM") return "di.rel.sectionSim";
  if (type === "DEVICE") return "di.rel.sectionDevices";
  if (type === "VEHICLE") return "di.rel.sectionVehicles";
  return "di.rel.sectionLocations";
}

function relationshipPrefillHref(entityType: DrugGraphNodeType, entityId: string, label: string): string | null {
  const relationId = ALL_RELATED_BY_TYPE[entityType];
  if (!relationId) return null;
  const params = new URLSearchParams({
    mode: "relationship",
    relSourceType: entityType,
    relSourceId: entityId,
    relSourceLabel: label,
    relationId,
  });
  return `/drug-intelligence/search?${params.toString()}`;
}

function RelatedCasesChronology({
  cases,
}: {
  cases: NonNullable<DrugRelationshipSearchResultItem["relatedCases"]>;
}) {
  const { t } = useT();
  if (!cases.length) return null;
  return (
    <ol className="space-y-1 border-l border-border/80 pl-3" data-testid="rel-case-chronology">
      {cases.map((c, i) => {
        const label =
          i === 0
            ? t("di.rel.chronologyFirst")
            : i === cases.length - 1 && cases.length > 1
              ? t("di.rel.chronologyLatest")
              : t("di.rel.chronologyNext");
        const when = formatThaiOperationalDateWithClock(c.arrestDate, c.arrestTime);
        return (
          <li key={c.caseId} className="text-xs text-foreground">
            <span className="font-medium text-muted">{label}</span>
            <span className="mx-1.5 text-border">·</span>
            <span className="font-semibold">{c.caseNumber}</span>
            {when ? <span className="text-muted"> — {when}</span> : null}
            {c.province ? <span className="text-muted"> · {c.province}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function OriginStrip({
  resolvedLabel,
  resolvedType,
  relationLabel,
  queryContext,
  canViewFull,
}: {
  resolvedLabel: string;
  resolvedType: DrugGraphNodeType;
  relationLabel: string;
  queryContext: DrugRelationshipSourceQueryContext | null;
  canViewFull: boolean;
}) {
  const { t } = useT();
  const fromValue = presentSourceQueryDisplayValue(queryContext, canViewFull);
  const fromFieldKey = searchedFromFieldLabelKey(queryContext?.matchedField);
  const typeLabel = t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[resolvedType] as TranslationKey);
  const FromIcon = searchedFromIcon(queryContext?.matchedField);

  return (
    <aside
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-3 py-2.5"
      data-testid="relationship-search-context"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <DrugEntityIconMark type={resolvedType} size="sm" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t("di.rel.originLabel")}
            <span className="sr-only"> {t("di.rel.searchContextHeading")}</span>
          </p>
          <p className="text-[11px] text-muted">{t("di.rel.searchContextResolved")}</p>
          <p className="truncate text-sm font-semibold text-foreground">{resolvedLabel}</p>
          <p className="text-xs text-muted">{typeLabel}</p>
        </div>
      </div>
      {fromValue ? (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <FromIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            <span className="font-medium text-muted">{t("di.rel.searchContextFrom")}: </span>
            {fromFieldKey ? `${t(fromFieldKey)} · ` : null}
            {fromValue}
          </span>
        </div>
      ) : null}
      <p className="ml-auto text-xs text-muted">{relationLabel}</p>
    </aside>
  );
}

function ResultCountSummary({
  byTargetType,
  total,
  earliestArrest,
  latestArrest,
}: {
  byTargetType: Partial<Record<DrugGraphNodeType, number>>;
  total: number;
  earliestArrest: string | null;
  latestArrest: string | null;
}) {
  const { t } = useT();
  const chips = GROUP_ORDER.map((type) => ({ type, count: byTargetType[type] ?? 0 })).filter((c) => c.count > 0);
  if (chips.length === 0 && total === 0) return null;

  return (
    <div className="space-y-2" data-testid="relationship-overview">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold text-foreground">{t("di.rel.resultsHeading")}</h2>
        {total > 0 ? (
          <p className="text-xs text-muted">{t("di.rel.summaryTotalEntities").replace("{count}", String(total))}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" data-testid="relationship-result-summary">
        {chips.map(({ type, count }) => (
          <div
            key={type}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-neutral-bg/40 px-2.5 py-1"
            data-testid={`rel-summary-count-${type}`}
          >
            <span className="text-xs text-muted">{t(sectionTitleKey(type))}</span>
            <span className="text-sm font-semibold text-foreground">{count}</span>
          </div>
        ))}
      </div>
      {earliestArrest && latestArrest ? (
        <p className="text-xs text-muted">
          {t("di.rel.summaryDateRange")
            .replace("{from}", formatThaiOperationalDate(earliestArrest))
            .replace("{to}", formatThaiOperationalDate(latestArrest))}
        </p>
      ) : null}
    </div>
  );
}

function CompactResultRow({
  item,
  returnPath,
  onExpand,
  expandDisabled,
}: {
  item: DrugRelationshipSearchResultItem;
  returnPath: string;
  onExpand: (payload: {
    entityType: DrugGraphNodeType;
    entityId: string;
    label: string;
    edgeKind: DrugRelationshipSearchResultItem["edgeKind"];
    evidenceSummary: string;
  }) => void;
  expandDisabled: boolean;
}) {
  const { t, language } = useT();
  const lang = language === "th" ? "th" : "en";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const WhyIcon = DRUG_RELATION_STEP_ICON;
  const EvidenceIcon = DRUG_EVIDENCE_SECTION_ICON;

  const compactWhy = relationshipCompactWhyText(item, lang, (role) => roleLabel(role, lang), t);
  const why = relationshipWhyFoundText(item, lang, (role) => roleLabel(role, lang), t);
  const evidence = relationshipEvidenceText(item, lang, (role) => roleLabel(role, lang), t);
  const networkHref = withReturnTo(`${item.actions.networkPath}&depth=2`, returnPath);
  const detailHref = item.actions.detailPath ? withReturnTo(item.actions.detailPath, returnPath) : null;
  const relHref = relationshipPrefillHref(item.to.entityType, item.to.entityId, item.to.label);
  const relatedCases = item.relatedCases ?? [];
  const caseCount = Math.max(relatedCases.length, item.sourceCaseIds.length);
  const primaryCase = relatedCases[0] ?? null;
  const pathIndex =
    item.explanation && typeof item.explanation === "object" && "pathIndex" in item.explanation
      ? item.explanation.pathIndex
      : undefined;

  const primaryLabel =
    item.to.entityType === "CASE"
      ? t("di.rel.openCase")
      : item.to.entityType === "PERSON"
        ? t("di.rel.openProfile")
        : t("di.rel.viewDetail");

  return (
    <article
      className="rounded-lg border border-border/80 bg-surface px-3 py-2.5"
      data-testid="relationship-result-card"
      data-entity-type={item.to.entityType}
      data-compact="true"
    >
      <div className="flex gap-2.5">
        <DrugEntityVisualThumb
          entityType={item.to.entityType}
          label={item.to.label}
          thumbnailUrl={item.to.visual?.thumbnailUrl}
          size="xs"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {item.resultKind === "PATH" && pathIndex ? (
                <p className="text-[11px] font-medium text-muted">
                  {t("di.rel.pathIndexLabel").replace("{n}", String(pathIndex))}
                </p>
              ) : null}
              <p className="truncate text-sm font-semibold text-foreground">{item.to.label}</p>
              {item.to.secondaryLabel ? (
                <p className="truncate text-xs text-muted">{item.to.secondaryLabel}</p>
              ) : null}
            </div>
            <Badge kind={item.edgeKind} />
          </div>

          <p className="text-xs text-foreground" data-testid="rel-compact-why">
            {compactWhy}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {caseCount > 0 ? (
              <span>{t("di.rel.compactCaseCount").replace("{count}", String(caseCount))}</span>
            ) : null}
            {primaryCase ? (
              <>
                {caseCount > 0 ? <span className="text-border">·</span> : null}
                <span className="font-medium text-foreground">{primaryCase.caseNumber}</span>
                {primaryCase.arrestDate ? (
                  <>
                    <span className="text-border">·</span>
                    <span>{formatThaiOperationalDate(primaryCase.arrestDate)}</span>
                  </>
                ) : null}
                {primaryCase.province ? (
                  <>
                    <span className="text-border">·</span>
                    <span>{primaryCase.province}</span>
                  </>
                ) : null}
              </>
            ) : null}
            {caseCount >= 2 ? (
              <span className="font-medium text-foreground" data-testid="rel-multi-case-banner">
                {t("di.rel.multiCaseBanner")}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {detailHref ? (
              <Button asChild variant="accent" size="sm" className="h-8 min-h-8 px-2.5 text-xs">
                <Link href={detailHref}>{primaryLabel}</Link>
              </Button>
            ) : null}
            {relHref ? (
              <Button asChild variant="outline" size="sm" className="h-8 min-h-8 px-2.5 text-xs">
                <Link href={relHref}>{t("di.rel.viewRelationships")}</Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 min-h-8 px-2 text-xs"
              data-testid="rel-toggle-details"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((v) => !v)}
            >
              {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
              {detailsOpen ? t("di.rel.collapseDetails") : t("di.rel.expandDetails")}
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 min-h-8 px-2 text-xs text-muted">
              <Link href={networkHref}>{t("di.rel.openInGraph")}</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 min-h-8 px-2 text-xs text-muted"
              title={expandDisabled ? t("di.rel.expandDisabledLimit") : t("di.rel.expandHint")}
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
              <Button asChild variant="ghost" size="sm" className="h-8 min-h-8 px-2 text-xs text-muted">
                <Link href={withReturnTo(item.actions.timelinePath, returnPath)}>{t("di.rel.viewTimeline")}</Link>
              </Button>
            ) : null}
            {item.actions.mapPath ? (
              <Button asChild variant="ghost" size="sm" className="h-8 min-h-8 px-2 text-xs text-muted">
                <Link href={withReturnTo(item.actions.mapPath, returnPath)}>{t("di.rel.viewMap")}</Link>
              </Button>
            ) : null}
          </div>

          {detailsOpen ? (
            <div
              className="mt-1 space-y-2 rounded-md border border-border/70 bg-neutral-bg/30 px-2.5 py-2"
              data-testid="rel-expanded-evidence"
            >
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <WhyIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("di.rel.whyFoundLabel")}
                </p>
                <p className="text-xs text-foreground">{why}</p>
              </div>
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <EvidenceIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("di.rel.evidenceInSystem")}
                </p>
                <p className="text-xs text-foreground">{evidence}</p>
              </div>
              {relatedCases.length > 0 ? <RelatedCasesChronology cases={relatedCases} /> : null}
              {item.pathSteps && item.pathSteps.length > 0 ? (
                <ol className="list-decimal space-y-0.5 pl-4 text-xs" data-testid="rel-path-steps">
                  {item.pathSteps.map((step, i) => (
                    <li key={`${step.entity.entityId}-${i}`} className="flex items-center gap-1.5">
                      <DrugEntityVisualThumb
                        entityType={step.entity.entityType}
                        label={step.entity.label}
                        thumbnailUrl={step.entity.visual?.thumbnailUrl}
                        size="xs"
                      />
                      <span>
                        {step.entity.label}
                        {step.viaRelationshipType ? ` (${step.viaRelationshipType})` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
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
  const { t } = useT();
  const relation = relationId ? getControlledRelation(relationId) : null;
  const relationLabel = relation ? t(relation.labelKey) : t("di.rel.relationSection");
  const resolvedLabel = sourceLabel || data.results[0]?.from.label || "—";
  const resolvedType = sourceType || data.interpretation.source.entityType;

  const pathResults = data.results.filter((r) => r.resultKind === "PATH");
  const edgeResults = data.results.filter((r) => r.resultKind !== "PATH");

  const grouped = GROUP_ORDER.map((type) => ({
    type,
    items: edgeResults.filter((r) => r.to.entityType === type),
  })).filter((g) => g.items.length > 0);

  const allCaseDates = data.results
    .flatMap((r) => r.relatedCases ?? [])
    .map((c) => c.arrestDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const earliestArrest = allCaseDates[0] ?? null;
  const latestArrest = allCaseDates.length ? allCaseDates[allCaseDates.length - 1]! : null;

  return (
    <div className="space-y-3" data-testid="relationship-search-results">
      <OriginStrip
        resolvedLabel={resolvedLabel}
        resolvedType={resolvedType}
        relationLabel={relationLabel}
        queryContext={queryContext ?? null}
        canViewFull={Boolean(canViewFull)}
      />

      {data.summary.found ? (
        <ResultCountSummary
          byTargetType={data.summary.byTargetType}
          total={data.summary.total}
          earliestArrest={earliestArrest}
          latestArrest={latestArrest}
        />
      ) : (
        <div className="space-y-1" data-testid="relationship-result-summary">
          <h2 className="text-base font-semibold text-foreground">{t("di.rel.resultsHeading")}</h2>
        </div>
      )}

      {data.truncated ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">{t("di.rel.truncatedNotice")}</p>
      ) : null}

      {!data.summary.found ? (
        <div
          className="space-y-1 rounded-lg border border-border bg-surface p-3"
          data-testid="relationship-no-evidence"
        >
          <p className="text-sm font-medium text-foreground">{t("di.rel.pathNotFound")}</p>
          <p className="text-xs text-muted">{t("di.rel.pathNotFoundHint")}</p>
        </div>
      ) : null}

      {pathResults.length > 0 ? (
        <section className="space-y-2" data-testid="relationship-path-section">
          <h3 className="text-sm font-semibold text-foreground">
            {t("di.rel.sectionPaths")} ({pathResults.length})
          </h3>
          <div className="space-y-2">
            {pathResults.map((item, index) => (
              <CompactResultRow
                key={`path-${item.to.entityId}-${index}`}
                item={item}
                returnPath={returnPath}
                onExpand={onExpand}
                expandDisabled={expandDisabled}
              />
            ))}
          </div>
        </section>
      ) : null}

      {grouped.map((group) => (
        <section key={group.type} className="space-y-2" data-testid={`relationship-group-${group.type}`}>
          <h3 className="text-sm font-semibold text-foreground">
            {t(sectionTitleKey(group.type))} ({group.items.length})
          </h3>
          <div className="space-y-2">
            {group.items.map((item, index) => (
              <CompactResultRow
                key={`${item.to.entityId}-${item.relationshipType ?? "edge"}-${index}`}
                item={item}
                returnPath={returnPath}
                onExpand={onExpand}
                expandDisabled={expandDisabled}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Keep ScanSearch import meaningful for empty visual affordance in context tests */}
      {!data.summary.found && data.results.length === 0 ? (
        <span className="sr-only">
          <ScanSearch className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}
