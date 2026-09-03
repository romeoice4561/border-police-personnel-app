/**
 * Phase 1C — Investigation Trail chrome (breadcrumb + step detail + actions).
 * Presentation only; trail state is owned by the Relationship Search panel.
 */
"use client";

import { ChevronRight, Undo2 } from "lucide-react";
import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { DrugEntityIconMark } from "@/components/drug_intelligence/drug_entity_visual";
import { Button } from "@/components/ui/button";
import { withReturnTo } from "@/lib/ui/return_context";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { getControlledRelation } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import {
  INVESTIGATION_TRAIL_MAX_EXPANSIONS,
  canExpandInvestigationTrail,
  currentInvestigationEntity,
  type InvestigationTrailState,
} from "@/lib/drug_intelligence/drug_relationship_investigation_trail";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function edgeKindLabelKey(kind: string): TranslationKey {
  if (kind === "INFERRED") return "di.rel.badgeInferred";
  if (kind === "PATH") return "di.rel.badgePath";
  return "di.rel.badgeDirect";
}

export function DrugRelationshipInvestigationTrail({
  trail,
  currentSourceLabel,
  returnPath,
  atExpandLimit,
  onBackOneStep,
  onNewSearch,
}: {
  trail: InvestigationTrailState;
  currentSourceLabel?: string;
  returnPath: string;
  atExpandLimit?: boolean;
  onBackOneStep: () => void;
  onNewSearch: () => void;
}) {
  const { t } = useT();
  if (!trail.origin && trail.steps.length === 0) return null;

  const current = currentInvestigationEntity(trail);
  const canBack = Boolean(trail.origin?.returnPath) || trail.steps.length > 0;
  const focusEntity = current;
  const networkHref = focusEntity
    ? withReturnTo(
        `/drug-intelligence/network?focusType=${encodeURIComponent(focusEntity.entityType)}&focusId=${encodeURIComponent(focusEntity.entityId)}&depth=2`,
        returnPath
      )
    : null;
  const limitReached = atExpandLimit || !canExpandInvestigationTrail(trail);
  const lastStep = trail.steps.length > 0 ? trail.steps[trail.steps.length - 1]! : null;

  return (
    <aside
      className="space-y-3 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-sm sm:px-4"
      data-testid="investigation-trail"
      aria-labelledby="investigation-trail-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id="investigation-trail-heading"
            className="text-sm font-semibold text-foreground"
          >
            {t("di.rel.trailHeading")}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{t("di.rel.trailHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10"
            disabled={!canBack}
            onClick={onBackOneStep}
            data-testid="trail-back-one-step"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("di.rel.trailBackOneStep")}
          </Button>
          {networkHref ? (
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <Link href={networkHref} data-testid="trail-open-network">
                {t("di.rel.trailOpenNetwork")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {trail.origin ? (
        <div
          className="rounded-lg border border-border/80 bg-neutral-bg/30 px-3 py-2"
          data-testid="trail-origin"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t("di.rel.trailOrigin")}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <DrugEntityIconMark type={trail.origin.entity.entityType} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground break-words">
                {trail.origin.entity.label}
              </p>
              <p className="text-xs text-muted">
                {t(
                  DRUG_GRAPH_NODE_TYPE_LABEL_KEY[trail.origin.entity.entityType] as TranslationKey
                )}
              </p>
              {trail.origin.queryContext?.matchedValueMasked ? (
                <p className="text-xs text-muted break-words">
                  {trail.origin.queryContext.matchedValueMasked}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Compact breadcrumb — horizontal on desktop, stacked on mobile */}
      <nav
        aria-label={t("di.rel.trailHeading")}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        data-testid="trail-breadcrumb"
      >
        {trail.origin ? (
          <TrailNode
            entityType={trail.origin.entity.entityType}
            label={trail.origin.entity.label}
            active={!current || current.entityId === trail.origin.entity.entityId}
            href={trail.origin.returnPath}
          />
        ) : null}
        {trail.steps.map((step, index) => (
          <div
            key={`${step.stepNumber}-${step.result.entityId}`}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <ChevronRight
              className="hidden h-4 w-4 shrink-0 text-muted sm:block"
              aria-hidden="true"
            />
            <span className="text-xs text-muted sm:hidden" aria-hidden="true">
              ↓
            </span>
            <TrailNode
              entityType={step.result.entityType}
              label={step.result.label}
              active={index === trail.steps.length - 1}
              href={step.returnPath}
              stepNumber={step.stepNumber}
            />
          </div>
        ))}
        {currentSourceLabel &&
        current &&
        !trail.steps.some((s) => s.result.entityId === current.entityId && s.result.label === currentSourceLabel) ? (
          <>
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted sm:block" aria-hidden="true" />
            <span className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent sm:ml-0">
              {t("di.rel.trailNowInvestigating")}: {currentSourceLabel}
            </span>
          </>
        ) : null}
      </nav>

      {lastStep ? (
        <div
          className="rounded-lg border border-border/70 bg-neutral-bg/25 px-3 py-2.5"
          data-testid="trail-step-detail"
        >
          <p className="text-xs font-semibold text-foreground">
            {t("di.rel.trailStepLabel").replace("{n}", String(lastStep.stepNumber))}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("di.rel.trailAsked")}{" "}
            <span className="font-medium text-foreground">
              {t(getControlledRelation(lastStep.relationId)?.labelKey ?? "di.rel.workflowLabel")}
            </span>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <DrugEntityIconMark type={lastStep.result.entityType} size="sm" />
            <div className="min-w-0">
              <p className="text-xs text-muted">{t("di.rel.trailFound")}</p>
              <p className="text-sm font-medium text-foreground break-words">
                {lastStep.result.label}
              </p>
            </div>
            <span className="ml-auto shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium">
              {t(edgeKindLabelKey(lastStep.edgeKind))}
            </span>
          </div>
          {lastStep.evidenceSummary ? (
            <p className="mt-1.5 text-xs text-muted break-words">
              {t("di.rel.trailEvidence")}: {lastStep.evidenceSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] text-muted" data-testid="trail-depth-hint">
        {t("di.rel.trailDepthHint")
          .replace("{used}", String(trail.steps.length))
          .replace("{max}", String(INVESTIGATION_TRAIL_MAX_EXPANSIONS))}
      </p>

      {limitReached ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-amber-700/30 bg-amber-50/80 px-3 py-2.5 dark:bg-amber-950/30 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          data-testid="trail-limit-reached"
        >
          <p className="text-sm font-medium text-foreground">{t("di.rel.trailLimitReached")}</p>
          <div className="flex flex-wrap gap-2">
            {networkHref ? (
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link href={networkHref}>{t("di.rel.trailOpenNetwork")}</Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={onNewSearch}
              data-testid="trail-limit-new-search"
            >
              {t("di.rel.newSearch")}
            </Button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function TrailNode({
  entityType,
  label,
  active,
  href,
  stepNumber,
}: {
  entityType: DrugGraphNodeType;
  label: string;
  active: boolean;
  href: string;
  stepNumber?: number;
}) {
  const { t } = useT();
  return (
    <Link
      href={href}
      data-testid={stepNumber ? `trail-node-step-${stepNumber}` : "trail-node-origin"}
      data-active={active ? "true" : "false"}
      className={[
        "inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
        active
          ? "border-accent bg-accent/10 text-foreground ring-1 ring-accent/30"
          : "border-border bg-neutral-bg/40 text-foreground hover:border-accent/40",
      ].join(" ")}
    >
      <DrugEntityIconMark type={entityType} size="sm" />
      <span className="min-w-0">
        {stepNumber ? (
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("di.rel.trailStepLabel").replace("{n}", String(stepNumber))}
          </span>
        ) : null}
        <span className="block truncate text-sm font-medium">{label}</span>
      </span>
    </Link>
  );
}
