/**
 * DI-8.6 — Network Inspector "Investigation Story" renderer (final
 * refinement: PREVIOUS→CURRENT natural sentences, merged conclusion path).
 * Presentation only; consumes NetworkPathStory (see drug_network_path_story.ts).
 *
 * Each transition step now shows ONE natural Thai sentence connecting the
 * previous entity to the current one — no more detached entity title +
 * separately-quoted relation label repeating the same fact twice.
 *
 * The compact origin→selected path is shown ONCE: inline inside the
 * conclusion for longer (>=3 hop) paths, and omitted entirely for short
 * paths where the numbered story above already makes it obvious — never a
 * second, separate breadcrumb section duplicating the same information.
 */
"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_ENTITY_ICON } from "@/components/drug_intelligence/drug_entity_visual";
import type { NetworkPathStory } from "@/lib/drug_intelligence/drug_network_path_story";

/** Compact, >=3-hop-only path recap shown inline in the conclusion — never rendered a second time elsewhere. */
const COMPACT_PATH_MIN_HOPS = 3;

export function DrugNetworkPathStoryView({
  story,
  onViewStepEvidence,
  activeEvidenceStepOrder = null,
  className,
}: {
  story: NetworkPathStory;
  /** Opens the existing evidence disclosure/section, scoped to THIS step's own edge-level evidence — reuses the bottom-level "หลักฐานในระบบ" architecture, never a duplicate full evidence panel per step. Receives the full step so the caller can identify which transition (order, previous/current label, case ids) was requested. */
  onViewStepEvidence?: (step: NetworkPathStory["steps"][number]) => void;
  /** The step.order currently shown in the evidence disclosure, if any — highlights that step so a click's effect is visible, not just a subtle color change (hotfix Section 4). */
  activeEvidenceStepOrder?: number | null;
  className?: string;
}) {
  const { t } = useT();

  return (
    <div className={cn("space-y-3", className)} data-testid="network-path-story">
      <p className="text-sm font-semibold leading-snug text-foreground" data-testid="network-path-story-question">
        {story.primaryQuestionText}
      </p>

      <ol className="space-y-0" data-testid="network-path-story-steps">
        {story.steps.map((step, index) => {
          const Icon = DRUG_ENTITY_ICON[step.entityType];
          const isActiveEvidence = step.kind === "transition" && activeEvidenceStepOrder === step.order;
          return (
            <li key={`story-${index}`} className="min-w-0" data-testid="network-path-story-step" data-step-order={step.order}>
              {index > 0 ? (
                <div className="flex items-center gap-1 pl-3 text-muted" aria-hidden="true">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              ) : null}
              <div
                className={cn(
                  "flex gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                  isActiveEvidence ? "border-accent bg-accent/10" : "border-border/80 bg-surface",
                )}
                data-active-evidence={isActiveEvidence ? "true" : "false"}
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                  {step.order}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-medium text-muted">{t(step.headingKey)}</p>
                  {step.kind === "origin" ? (
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <p className="truncate text-sm font-semibold leading-snug text-foreground">{step.entityLabel}</p>
                    </div>
                  ) : (
                    // DI-8.6 final refinement: ONE natural sentence that already
                    // states both the previous and current entity plus the
                    // recorded relationship — no separate detached title +
                    // quoted relation label repeating the same fact twice.
                    <div className="flex items-start gap-1.5">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <p className="text-sm leading-snug text-foreground" data-testid="network-path-story-sentence">
                        {step.sentence}
                      </p>
                    </div>
                  )}
                  {step.entitySecondaryLabel ? (
                    <p className="truncate text-[11px] text-muted">{step.entitySecondaryLabel}</p>
                  ) : null}
                  {step.kind === "transition" && step.evidenceCaseIds.length > 0 && onViewStepEvidence ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewStepEvidence(step)}
                        className="text-[11px] font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded"
                        data-testid="network-path-story-step-evidence"
                        aria-pressed={isActiveEvidence}
                      >
                        {t("di.network.storyEvidenceForStep")}
                      </button>
                      {isActiveEvidence ? (
                        <span className="text-[11px] font-medium text-accent" data-testid="network-path-story-step-evidence-active">
                          {t("di.network.storyEvidenceActiveNote").replace("{order}", String(step.order))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5"
        data-testid="network-path-story-conclusion"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          {t("di.network.storyConclusionHeading")}
        </p>
        <p className="text-xs leading-relaxed text-foreground" data-testid="network-path-story-conclusion-text">
          {story.conclusion.leadText}
          {story.conclusion.hopsText ? ` ${story.conclusion.hopsText}` : ""}
        </p>
        {!story.conclusion.isDirect && story.conclusion.pathLabels.length >= COMPACT_PATH_MIN_HOPS ? (
          <div data-testid="network-path-story-conclusion-path">
            <p className="text-[11px] font-medium text-muted">{t("di.network.storyConclusionPathHeading")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
              {story.conclusion.pathLabels.map((label, index) => (
                <span key={`${label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? <ArrowRight className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" /> : null}
                  <span className="text-[11px] font-medium text-foreground">{label}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
