/**
 * Node detail panel content (Phase DI-5, Section 10; polished DI-9.1
 * Section 9; DI-9.2 Section 14 adds a presentation-state pin section).
 * DI-8.4: explainable focus→selected path near the top of the Inspector.
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { DrugNetworkInspectorMedia } from "@/components/drug_intelligence/drug_network_inspector_media";
import { DrugNetworkPathStoryView } from "@/components/drug_intelligence/drug_network_path_story_view";
import { DrugNetworkInsightPanel } from "@/components/drug_intelligence/drug_network_insight_panel";
import { insightsForEntity, type NetworkGraphInsight } from "@/lib/drug_intelligence/drug_network_graph_insights";
import { withReturnTo } from "@/lib/ui/return_context";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import {
  networkHopBadgeKey,
  supportingCaseIdsFromPath,
  type NetworkPathExplanation,
} from "@/lib/drug_intelligence/drug_network_path_explanation";
import {
  buildNetworkPathStory,
  pathDescriptorFromIntermediates,
  type NetworkPathStoryStep,
} from "@/lib/drug_intelligence/drug_network_path_story";
import type { NetworkPathCameraMode } from "@/lib/drug_intelligence/drug_network_drawer_viewport";
import type { DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { formatThaiOperationalDate } from "@/lib/drug_intelligence/di_date_helpers";

export function DrugNetworkNodeDetail({
  node,
  onExpand,
  pinned,
  onTogglePin,
  isFocus,
  hopDistance,
  reasonKey,
  pathExplanation = null,
  selectedPathIndex = 0,
  onSelectPathIndex,
  pathCameraMode = "SELECTED_PATH",
  onPathCameraModeChange,
  openReturnPath = null,
  insights = [],
  onInsightViewOnGraph,
}: {
  node: DrugGraphNode;
  onExpand: () => void;
  /** DI-9.2: whether this node is currently pinned. Ignored unless `onTogglePin` is provided. */
  pinned?: boolean;
  /** DI-9.2: present only in Analyst Mode — omitting it hides the entire pin section (Section 3: no edit affordances in View Mode). */
  onTogglePin?: () => void;
  isFocus?: boolean;
  hopDistance?: number;
  reasonKey?: TranslationKey;
  /** DI-8.4: explainable paths from focus → this node (loaded neighborhood only). */
  pathExplanation?: NetworkPathExplanation | null;
  selectedPathIndex?: number;
  onSelectPathIndex?: (index: number) => void;
  pathCameraMode?: NetworkPathCameraMode;
  onPathCameraModeChange?: (mode: NetworkPathCameraMode) => void;
  /** Navigation-only Network (or other internal) path to restore after opening this entity. */
  openReturnPath?: string | null;
  /** DI-8.7 V1: the full set of deterministic observations for the currently loaded neighborhood — filtered internally to this node. */
  insights?: readonly NetworkGraphInsight[];
  onInsightViewOnGraph?: (insight: NetworkGraphInsight) => void;
}) {
  const { t } = useT();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  // DI-8.6 hotfix: which story step's own transition evidence is currently
  // shown in the "หลักฐานในระบบ" disclosure. Previously the click handler
  // only called setEvidenceOpen(true) and discarded the clicked step
  // entirely — a no-op after the very first click (true -> true never
  // re-renders), and there was no way to know which step's evidence was
  // being viewed. Reset on every path switch (selectedPathIndex change) so
  // a stale Path-1 selection can never be shown while Path 3 is active.
  const [activeEvidenceStep, setActiveEvidenceStep] = useState<NetworkPathStoryStep | null>(null);
  /** DI-8.6: scroll/follow target for the evidence disclosure — the Inspector's own scroll container (see network/page.tsx's Drawer) can hide the evidence section below the fold, especially on a long path; this brings it into view on every step click, including repeated clicks on different steps. */
  const evidenceSectionRef = useRef<HTMLDetailsElement | null>(null);

  const actionLabel =
    node.type === "PERSON"
      ? t("di.network.openProfile")
      : node.type === "CASE"
        ? t("di.network.openCase")
        : t("di.network.openDetail");
  const showOpenLink = node.type !== "LOCATION";
  // DI-8.7 V1: this node's own deterministic observations, filtered from
  // the full loaded-neighborhood insight set the page computed once.
  const nodeInsights = insightsForEntity(insights, node.id);
  const activePath =
    pathExplanation && !isFocus
      ? pathExplanation.paths[Math.min(selectedPathIndex, pathExplanation.paths.length - 1)] ?? null
      : null;
  const pathCount = pathExplanation?.paths.length ?? 0;
  const evidenceCaseIds = supportingCaseIdsFromPath(activePath);
  // DI-8.6: the numbered "Investigation Story" narrative — replaces the
  // previous DrugNetworkPathOverview + DrugNetworkPathSteps pair (same path
  // rendered twice) with ONE top-to-bottom narrative. Pure presentation
  // built from the exact same pathExplanation/activePath DI-8.4 already
  // computes — no new path enumeration, no new relationship classification.
  const story =
    pathExplanation && !isFocus && activePath ? buildNetworkPathStory(pathExplanation, activePath, t) : null;
  // DI-8.6 hotfix: reset the active evidence-step selection whenever the
  // active PATH itself changes (a different node selected, OR the same node
  // but a different path index/switch) — keyed on the path's own stable
  // signature (node.id + activePath.signature), not just selectedPathIndex,
  // so it also resets when a brand-new node happens to land on path index 0
  // again (selectedPathIndex would otherwise stay 0 -> 0 and never re-fire).
  // Never leaves a stale Path 1 step selected while Path 3 is active.
  const activePathSignature = activePath?.signature ?? null;
  useEffect(() => {
    setActiveEvidenceStep(null);
  }, [node.id, activePathSignature]);
  // DI-8.6: evidence follow/scroll — every time a step's evidence becomes
  // active (including switching directly from one step to a different one),
  // bring the evidence section into view within its own scroll container so
  // the officer doesn't have to manually scroll to find it. Guarded to only
  // run when a step is actually selected (never on the reset-to-null above,
  // which would otherwise scroll on every path/node switch for no reason).
  useEffect(() => {
    if (!activeEvidenceStep) return;
    evidenceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeEvidenceStep]);
  const hopKey =
    isFocus || hopDistance === 0
      ? null
      : hopDistance != null
        ? networkHopBadgeKey(hopDistance)
        : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DrugEntityVisualThumb
          entityType={node.type}
          label={node.label}
          thumbnailUrl={node.visual?.thumbnailUrl}
          size={node.type === "PERSON" ? "lg" : node.type === "VEHICLE" ? "md" : "sm"}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[node.type] as TranslationKey)}
          </p>
          <p className="text-lg font-semibold text-foreground">{node.label}</p>
          {node.secondaryLabel ? <p className="text-sm text-muted">{node.secondaryLabel}</p> : null}
          {node.metadata.type === "PERSON" ? (
            <p className="mt-1 text-xs text-muted">
              {t("di.profile.status")}:{" "}
              {node.metadata.status === "MERGED" ? t("di.profile.statusMerged") : t("di.profile.statusActive")}
            </p>
          ) : null}
          {hopKey ? (
            <p className="mt-1 text-xs font-medium text-muted" data-testid="network-inspector-hop">
              {t(hopKey)}
            </p>
          ) : isFocus ? (
            <p className="mt-1 text-xs font-medium text-muted">{t("di.network.hopFocus")}</p>
          ) : null}
        </div>
      </div>

      {!isFocus && pathExplanation && activePath && story && activePath.steps.length >= 2 ? (
        <div
          className="space-y-2.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5"
          data-testid="network-path-explanation"
        >
          {pathCount > 1 ? (
            <div className="space-y-1.5" data-testid="network-path-switcher">
              <p className="text-[11px] font-medium text-muted">
                {t("di.network.pathCountLabel").replace("{count}", String(pathCount))}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pathExplanation.paths.map((path, index) => {
                  // DI-8.6: a short descriptor derived only from that specific
                  // path's actual intermediate entity types (e.g. "ผ่านคดี") —
                  // never invented. Null (1-hop direct path) shows no descriptor.
                  const descriptor = pathDescriptorFromIntermediates(path, t);
                  return (
                    <button
                      key={`path-${index}`}
                      type="button"
                      className={
                        index === selectedPathIndex
                          ? "rounded-md bg-accent px-2 py-1 text-left text-[11px] font-semibold text-surface"
                          : "rounded-md border border-border bg-surface px-2 py-1 text-left text-[11px] font-medium text-foreground hover:bg-neutral-bg"
                      }
                      aria-pressed={index === selectedPathIndex}
                      onClick={() => onSelectPathIndex?.(index)}
                    >
                      {t("di.network.pathSwitchLabel").replace("{n}", String(index + 1))}
                      {descriptor ? <span className="opacity-80"> · {descriptor}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {onPathCameraModeChange ? (
            // DI-8.6: previously identical pill styling to the path switcher
            // above, stacked directly beneath it — easy to mistake "which
            // path" controls for "how much of the graph is visible" controls.
            // Now a distinct labeled segmented control (single bordered
            // group, no individual pill borders) so the two control families
            // read as visually separate. Same camera modes/behavior — DI-8.4
            // viewport/camera logic untouched.
            <div className="space-y-1" data-testid="network-path-camera-controls">
              <p className="text-[11px] font-medium text-muted">{t("di.network.cameraControlLabel")}</p>
              <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
                <button
                  type="button"
                  className={
                    pathCameraMode === "SELECTED_PATH"
                      ? "rounded px-2 py-1 text-[11px] font-semibold bg-accent text-surface"
                      : "rounded px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg"
                  }
                  aria-pressed={pathCameraMode === "SELECTED_PATH"}
                  onClick={() => onPathCameraModeChange("SELECTED_PATH")}
                >
                  {t("di.network.pathFocusSelected")}
                </button>
                <button
                  type="button"
                  className={
                    pathCameraMode === "FULL_NETWORK"
                      ? "rounded px-2 py-1 text-[11px] font-semibold bg-accent text-surface"
                      : "rounded px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg"
                  }
                  aria-pressed={pathCameraMode === "FULL_NETWORK"}
                  onClick={() => onPathCameraModeChange("FULL_NETWORK")}
                >
                  {t("di.network.pathFocusFull")}
                </button>
              </div>
            </div>
          ) : null}
          {/* DI-8.6: the numbered Investigation Story — replaces the old
              DrugNetworkPathOverview + DrugNetworkPathSteps pair (same path
              shown twice) AND the separate "สรุปความเชื่อมโยง" summary block
              (its role is now the story's own conclusion, worded identically
              strictly by DIRECT/hop-count — same underlying semantics, one
              narrative instead of two disconnected renderings). */}
          <div className="border-t border-border/60 pt-2">
            <DrugNetworkPathStoryView
              story={story}
              activeEvidenceStepOrder={activeEvidenceStep?.order ?? null}
              // DI-8.6 hotfix: previously discarded the clicked step entirely
              // (only ever called setEvidenceOpen(true), a no-op once already
              // open). Now the exact step is stored so the disclosure below
              // can scope itself to THAT transition's own evidence.
              onViewStepEvidence={(step) => {
                setActiveEvidenceStep(step);
                setEvidenceOpen(true);
              }}
            />
          </div>
          {evidenceCaseIds.length > 0 ? (
            <details
              ref={evidenceSectionRef}
              className="border-t border-border/60 pt-2"
              data-testid="network-path-evidence"
              open={evidenceOpen}
              onToggle={(e) => setEvidenceOpen(e.currentTarget.open)}
            >
              <summary className="cursor-pointer text-[11px] font-semibold text-muted">
                {t("di.network.pathEvidenceHeading")}
              </summary>
              {activeEvidenceStep ? (
                <div className="mt-1.5 mb-2 rounded-md bg-neutral-bg/60 px-2 py-1.5" data-testid="network-path-evidence-step-caption">
                  <p className="text-[11px] font-semibold text-foreground">
                    {t("di.network.storyEvidenceStepCaption").replace("{order}", String(activeEvidenceStep.order))}
                  </p>
                  {activeEvidenceStep.previousLabel ? (
                    <p className="text-[11px] text-muted">
                      {t("di.network.storyEvidenceStepTransition")
                        .replace("{previous}", activeEvidenceStep.previousLabel)
                        .replace("{current}", activeEvidenceStep.entityLabel)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {(() => {
                // DI-8.6 hotfix: scope the list to the ACTIVE STEP's own edge-level
                // evidence (NetworkPathStoryStep.evidenceCaseIds, i.e. that one
                // transition's supportingCaseIds) when a step is selected and it
                // actually carries its own evidence. Falls back to the full
                // path-level list — with an explicit "path-level, not step-specific"
                // note — only when no step is selected, or the selected step's own
                // edge has no recorded evidence but the path overall does. Never
                // fabricates evidence that was not actually recorded.
                const stepScoped = activeEvidenceStep && activeEvidenceStep.evidenceCaseIds.length > 0;
                const idsToShow = stepScoped ? activeEvidenceStep!.evidenceCaseIds : evidenceCaseIds;
                if (idsToShow.length === 0) {
                  return (
                    <p className="text-xs text-muted" data-testid="network-path-evidence-empty">
                      {t("di.network.storyEvidenceStepEmpty")}
                    </p>
                  );
                }
                return (
                  <>
                    {activeEvidenceStep && !stepScoped ? (
                      <p className="mb-1 text-[11px] text-muted" data-testid="network-path-evidence-path-level-note">
                        {t("di.network.storyEvidencePathLevelNote")}
                      </p>
                    ) : null}
                    <ul className="space-y-1">
                      {idsToShow.map((caseId) => {
                        const caseNode =
                          activePath.steps.find((s) => s.nodeId === caseId && s.entityType === "CASE") ?? null;
                        const label = caseNode?.label ?? caseId;
                        return (
                          <li key={caseId}>
                            <Link
                              href={withReturnTo(drugEntityDetailPath("CASE", caseId), openReturnPath)}
                              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                            >
                              {t("di.network.openRelatedCase")}: {label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                );
              })()}
            </details>
          ) : null}
        </div>
      ) : !isFocus && pathExplanation === null && hopDistance != null && hopDistance >= 1 ? (
        <p className="rounded-lg bg-neutral-bg/60 px-3 py-2 text-xs text-muted" data-testid="network-path-missing">
          {t("di.network.pathNoPath")}
        </p>
      ) : null}

      {(reasonKey || hopDistance !== undefined) && !pathExplanation ? (
        <div className="rounded-lg bg-neutral-bg/60 px-3 py-2 text-xs text-foreground">
          <p>
            <span className="text-muted">{t("di.network.graphRelationHeading")}</span>{" "}
            {isFocus || hopDistance === 0
              ? t("di.network.hopFocus")
              : hopDistance === 1
                ? t("di.network.hopDirect")
                : t("di.network.hopIndirect")}
          </p>
          {reasonKey ? <p className="mt-1 text-muted">{t(reasonKey)}</p> : null}
        </div>
      ) : null}

      <DrugNetworkInspectorMedia entityType={node.type} entityId={node.id} openReturnPath={openReturnPath} />

      {node.riskIndicators.length > 0 ? (
        <div className="space-y-1.5">
          {node.riskIndicators.includes("POTENTIAL_DUPLICATE_PERSON") ? (
            <p className="flex items-center gap-1.5 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("di.network.riskDuplicate")}
            </p>
          ) : null}
          {node.riskIndicators.includes("HIGH_CASE_COUNT") ? (
            <Badge tone="warning">{t("di.network.riskHighCaseCount")}</Badge>
          ) : null}
        </div>
      ) : null}

      {node.type === "PERSON" && node.metadata.type === "PERSON" && node.metadata.canonicalTarget ? (
        <p className="rounded-lg bg-neutral-bg px-3 py-2 text-xs text-muted">{t("di.network.mergedNotice")}</p>
      ) : null}

      {/* DI-8.7 V1: "ข้อสังเกตจากข้อมูล" — deterministic recorded-data
          observations for this node. Placed after Identity/Investigation
          Story/Evidence and before technical metadata (Section 10). Not a
          second drawer, not a new dashboard — one more section in the
          existing Inspector. */}
      {onInsightViewOnGraph ? (
        <div className="border-t border-border/60 pt-2">
          <DrugNetworkInsightPanel
            insights={nodeInsights}
            onViewOnGraph={onInsightViewOnGraph}
            openReturnPath={openReturnPath}
          />
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {node.type === "CASE" ? (
          <>
            {node.metadata.type === "CASE" ? (
              <>
                <div>
                  <dt className="text-xs text-muted">{t("di.field.arrestDate")}</dt>
                  <dd className="text-foreground">
                    {node.metadata.arrestDate ? formatThaiOperationalDate(node.metadata.arrestDate) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t("di.field.province")}</dt>
                  <dd className="text-foreground">{node.metadata.province || "—"}</dd>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div>
              <dt className="text-xs text-muted">{t("di.network.firstRecorded")}</dt>
              <dd className="text-foreground">
                {node.firstSeenAt ? formatThaiOperationalDate(node.firstSeenAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("di.network.lastRecorded")}</dt>
              <dd className="text-foreground">
                {node.lastSeenAt ? formatThaiOperationalDate(node.lastSeenAt) : "—"}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt className="text-xs text-muted">{t("di.entity.sourceCases")}</dt>
          <dd className="text-foreground">{node.caseCount}</dd>
        </div>
        {node.metadata.type === "PHONE" && node.metadata.carrier ? (
          <div>
            <dt className="text-xs text-muted">{t("di.entity.carrier")}</dt>
            <dd className="text-foreground">{node.metadata.carrier}</dd>
          </div>
        ) : null}
        {node.metadata.type === "SIM" ? (
          <>
            {node.metadata.imsi ? (
              <div>
                <dt className="text-xs text-muted">{t("di.entity.imsi")}</dt>
                <dd className="text-foreground">{node.metadata.imsi}</dd>
              </div>
            ) : null}
            {node.metadata.carrier ? (
              <div>
                <dt className="text-xs text-muted">{t("di.entity.carrier")}</dt>
                <dd className="text-foreground">{node.metadata.carrier}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {node.metadata.type === "DEVICE" ? (
          <div>
            <dt className="text-xs text-muted">{t("di.entity.brand")}</dt>
            <dd className="text-foreground">
              {[node.metadata.brand, node.metadata.model].filter(Boolean).join(" ") || "—"}
            </dd>
          </div>
        ) : null}
        {node.metadata.type === "VEHICLE" ? (
          <div>
            <dt className="text-xs text-muted">{t("di.entity.registrationProvince")}</dt>
            <dd className="text-foreground">{node.metadata.registrationProvince || "—"}</dd>
          </div>
        ) : null}
        {node.metadata.type === "LOCATION" ? (
          <div>
            <dt className="text-xs text-muted">{t("di.field.province")}</dt>
            <dd className="text-foreground">
              {[node.metadata.province, node.metadata.district].filter(Boolean).join(" / ") || "—"}
            </dd>
          </div>
        ) : null}
      </dl>

      {onTogglePin ? (
        <div className="space-y-1.5 rounded-lg border border-border bg-neutral-bg/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.network.pinStatusTitle")}</p>
          <p className="text-sm text-foreground">
            {pinned ? t("di.network.pinStatusPinned") : t("di.network.pinStatusUnpinned")}
          </p>
          <Button variant="outline" size="sm" onClick={onTogglePin}>
            {pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
            {pinned ? t("di.network.unpinNode") : t("di.network.pinNode")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {showOpenLink ? (
          <Button asChild size="sm">
            <Link href={withReturnTo(drugEntityDetailPath(node.type, node.id), openReturnPath)}>{actionLabel}</Link>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onExpand}>
          {t("di.network.expandNode")}
        </Button>
        {showOpenLink &&
        (node.type === "PERSON" || node.type === "VEHICLE" || node.type === "CASE" || node.type === "DEVICE") ? (
          <Button asChild variant="outline" size="sm">
            <Link href={withReturnTo(`${drugEntityDetailPath(node.type, node.id)}#media`, openReturnPath)}>
              {t("di.media.openGallery")}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
