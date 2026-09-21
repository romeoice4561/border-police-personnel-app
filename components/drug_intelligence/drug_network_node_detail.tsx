/**
 * Node detail panel content (Phase DI-5, Section 10; polished DI-9.1
 * Section 9; DI-9.2 Section 14 adds a presentation-state pin section).
 * DI-8.4: explainable focus→selected path near the top of the Inspector.
 */
"use client";

import Link from "next/link";
import { AlertTriangle, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { DrugNetworkInspectorMedia } from "@/components/drug_intelligence/drug_network_inspector_media";
import { DrugNetworkPathOverview, DrugNetworkPathSteps } from "@/components/drug_intelligence/drug_network_path_steps";
import { withReturnTo } from "@/lib/ui/return_context";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import {
  formatNetworkPathSummary,
  networkHopBadgeKey,
  networkPathWhyHeadingKey,
  supportingCaseIdsFromPath,
  type NetworkPathExplanation,
} from "@/lib/drug_intelligence/drug_network_path_explanation";
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
}) {
  const { t } = useT();

  const actionLabel =
    node.type === "PERSON"
      ? t("di.network.openProfile")
      : node.type === "CASE"
        ? t("di.network.openCase")
        : t("di.network.openDetail");
  const showOpenLink = node.type !== "LOCATION";
  const activePath =
    pathExplanation && !isFocus
      ? pathExplanation.paths[Math.min(selectedPathIndex, pathExplanation.paths.length - 1)] ?? null
      : null;
  const pathCount = pathExplanation?.paths.length ?? 0;
  const evidenceCaseIds = supportingCaseIdsFromPath(activePath);
  const whyHeading =
    pathExplanation && !isFocus
      ? t(networkPathWhyHeadingKey(pathExplanation.selectedType)).replace(
          "{label}",
          pathExplanation.selectedLabel,
        )
      : t("di.network.pathWhyHeading");
  const summaryText =
    pathExplanation && !isFocus
      ? formatNetworkPathSummary(pathExplanation, (key) => t(key), selectedPathIndex)
      : null;
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

      {!isFocus && pathExplanation && activePath && activePath.steps.length >= 2 ? (
        <div
          className="space-y-2.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5"
          data-testid="network-path-explanation"
        >
          <p className="text-xs font-semibold text-accent">{whyHeading}</p>
          <DrugNetworkPathOverview steps={activePath.steps} />
          <DrugNetworkPathSteps steps={activePath.steps} />
          {pathCount > 1 ? (
            <div className="space-y-1.5" data-testid="network-path-switcher">
              <p className="text-[11px] font-medium text-muted">
                {t("di.network.pathCountLabel").replace("{count}", String(pathCount))}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pathExplanation.paths.map((_, index) => (
                  <button
                    key={`path-${index}`}
                    type="button"
                    className={
                      index === selectedPathIndex
                        ? "rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-surface"
                        : "rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg"
                    }
                    aria-pressed={index === selectedPathIndex}
                    onClick={() => onSelectPathIndex?.(index)}
                  >
                    {t("di.network.pathSwitchLabel").replace("{n}", String(index + 1))}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {onPathCameraModeChange ? (
            <div className="flex flex-wrap gap-1.5" data-testid="network-path-camera-controls">
              <button
                type="button"
                className={
                  pathCameraMode === "SELECTED_PATH"
                    ? "rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-surface"
                    : "rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg"
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
                    ? "rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-surface"
                    : "rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg"
                }
                aria-pressed={pathCameraMode === "FULL_NETWORK"}
                onClick={() => onPathCameraModeChange("FULL_NETWORK")}
              >
                {t("di.network.pathFocusFull")}
              </button>
            </div>
          ) : null}
          {summaryText ? (
            <div className="border-t border-border/60 pt-2" data-testid="network-path-summary">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t("di.network.pathSummaryHeading")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">{summaryText}</p>
            </div>
          ) : null}
          {evidenceCaseIds.length > 0 ? (
            <details className="border-t border-border/60 pt-2" data-testid="network-path-evidence">
              <summary className="cursor-pointer text-[11px] font-semibold text-muted">
                {t("di.network.pathEvidenceHeading")}
              </summary>
              <ul className="mt-1.5 space-y-1">
                {evidenceCaseIds.map((caseId) => {
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
