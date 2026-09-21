/**
 * DI-8.4 — Compact vertical path-step UI for the Network Inspector.
 * Presentation only; steps come from NetworkPathExplanation / loaded graph.
 */
"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_ENTITY_ICON } from "@/components/drug_intelligence/drug_entity_visual";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { NetworkPathStepExplanation } from "@/lib/drug_intelligence/drug_network_path_explanation";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function DrugNetworkPathSteps({
  steps,
  className,
}: {
  steps: readonly NetworkPathStepExplanation[];
  className?: string;
}) {
  const { t } = useT();
  if (steps.length === 0) return null;

  return (
    <ol
      className={cn("space-y-0 text-sm", className)}
      data-testid="network-path-steps"
      aria-label={t("di.network.selectedPathHeading")}
    >
      {steps.map((step, index) => {
        const Icon = DRUG_ENTITY_ICON[step.entityType];
        const typeLabel = t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[step.entityType] as TranslationKey);
        return (
          <li key={`${step.nodeId}-${index}`} className="min-w-0" data-testid="network-path-step">
            {index > 0 && step.viaLabelKey ? (
              <p
                className="mb-1.5 flex items-center gap-1 pl-1 text-[11px] font-medium text-muted"
                data-testid="network-path-relation"
              >
                <ArrowDown className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
                <span>{t(step.viaLabelKey)}</span>
              </p>
            ) : index > 0 ? (
              <p className="mb-1.5 flex items-center gap-1 pl-1 text-[11px] text-muted">
                <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
              </p>
            ) : null}
            <div className="flex min-w-0 items-start gap-2 rounded-md border border-border/80 bg-surface px-2 py-1.5">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-neutral-bg text-accent">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{typeLabel}</p>
                <p className="truncate font-semibold leading-snug text-foreground">{step.label}</p>
                {step.secondaryLabel ? (
                  <p className="truncate text-[11px] text-muted">{step.secondaryLabel}</p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact horizontal overview — supplementary to the vertical explanation. */
export function DrugNetworkPathOverview({
  steps,
  className,
}: {
  steps: readonly NetworkPathStepExplanation[];
  className?: string;
}) {
  const { t } = useT();
  if (steps.length < 2) return null;

  return (
    <div className={cn("space-y-1", className)} data-testid="network-path-overview">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t("di.network.pathOverviewHeading")}
      </p>
      <div className="overflow-x-auto pb-0.5">
        <ol className="flex min-w-min items-center gap-1">
          {steps.map((step, index) => {
            const Icon = DRUG_ENTITY_ICON[step.entityType];
            return (
              <li key={`overview-${step.nodeId}-${index}`} className="flex shrink-0 items-center gap-1">
                {index > 0 ? (
                  <span
                    className="inline-flex max-w-[7.5rem] flex-col items-center px-0.5 text-center text-[9px] leading-tight text-muted"
                    data-testid="network-path-overview-relation"
                    title={step.viaLabelKey ? t(step.viaLabelKey) : undefined}
                  >
                    <ArrowRight className="h-3 w-3 text-accent" aria-hidden="true" />
                    {step.viaLabelKey ? <span className="line-clamp-2">{t(step.viaLabelKey)}</span> : null}
                  </span>
                ) : null}
                <span className="inline-flex max-w-[8.5rem] items-center gap-1 rounded border border-border bg-surface px-1.5 py-1">
                  <Icon className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
                  <span className="truncate text-[11px] font-semibold text-foreground">{step.label}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
