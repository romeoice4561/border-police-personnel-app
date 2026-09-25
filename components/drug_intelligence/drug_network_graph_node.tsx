/**
 * Intelligence-card renderer for the C-INTEL Network canvas.
 * Presentation only — does not change graph semantics or query results.
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Pin } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_ENTITY_ICON } from "@/components/drug_intelligence/drug_entity_visual";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { formatGraphNodeCard } from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugNetworkFlowNodeData } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const NODE_ICON = DRUG_ENTITY_ICON;

const CARD_ACCENT: Record<DrugGraphNodeType, string> = {
  PERSON: "border-l-accent",
  CASE: "border-l-critical",
  PHONE: "border-l-good",
  SIM: "border-l-good",
  DEVICE: "border-l-warning",
  VEHICLE: "border-l-serious",
  LOCATION: "border-l-neutral",
};

const ICON_TONE: Record<DrugGraphNodeType, string> = {
  PERSON: "text-accent",
  CASE: "text-critical",
  PHONE: "text-good",
  SIM: "text-good",
  DEVICE: "text-warning",
  VEHICLE: "text-serious",
  LOCATION: "text-muted",
};

function countLabel(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

export function DrugNetworkGraphNode({ data, selected }: NodeProps & { data: DrugNetworkFlowNodeData }) {
  const {
    graphNode,
    isFocus,
    density,
    dimmed,
    pinned,
    hopDistance,
    isShared,
    onSelectedPath,
    showHopBadge,
    stronglyDimmed,
    temporalFocused,
    temporalContextDimmed,
    pathViaHint,
    pathViaMoreCount,
    compareRole,
    compareSlot,
    compareJunction,
    compareInspect,
    neighborCounts,
    canExpand,
    onExpand,
  } = data;
  const { t } = useT();
  const Icon = NODE_ICON[graphNode.type];
  const hasRisk = graphNode.riskIndicators.length > 0;
  const isCompact = density === "COMPACT";
  const card = formatGraphNodeCard(graphNode);
  const focusCaption = graphNode.type === "PERSON" && isFocus ? t("di.network.focusPerson") : t("di.network.focusNode");
  const sharedCaption = graphNode.caseCount > 2
    ? `${t("di.network.sharedLinkPrefix")} ${graphNode.caseCount} ${t("di.network.summaryCases")}`
    : t("di.network.sharedManyCases");
  const compareEndpoint = compareRole === "endpoint";
  const comparePath = compareRole === "path";
  const compareJunctionNode = Boolean(compareJunction && comparePath);
  const typeKey = graphNode.type === "DEVICE" ? "di.network.groupDeviceImei" : DRUG_GRAPH_NODE_TYPE_LABEL_KEY[graphNode.type];
  const title = card.title || t(typeKey as TranslationKey);
  const photoSize = isCompact ? "search" : isFocus && graphNode.type === "PERSON" ? "graphCardFocus" : "graphCard";
  const summary = cardSummary();
  const stats = cardStats();
  const hopBadgeKey =
    hopDistance <= 1 ? "di.network.hopBadgeOne" : hopDistance === 2 ? "di.network.hopBadgeTwo" : "di.network.hopBadgeThree";
  const viaCaption = pathViaHint
    ? t("di.network.pathViaPrefix").replace("{label}", pathViaHint)
    : null;

  function cardSummary(): string | null {
    if (graphNode.type === "PERSON") {
      if (graphNode.caseCount > 0) return countLabel(t("di.network.cardRelatedCases"), graphNode.caseCount);
      return null;
    }
    if (graphNode.type === "PHONE") {
      const parts = [
        graphNode.caseCount > 0 ? countLabel(t("di.network.cardFoundInCases"), graphNode.caseCount) : null,
        neighborCounts.PERSON > 0 ? countLabel(t("di.network.cardLinkedPeople"), neighborCounts.PERSON) : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : null;
    }
    if (graphNode.type === "VEHICLE") {
      if (graphNode.caseCount > 0) return countLabel(t("di.network.cardFoundInCases"), graphNode.caseCount);
      return card.subtitle;
    }
    if (graphNode.type === "CASE" && graphNode.metadata.type === "CASE") {
      const date = graphNode.metadata.arrestDate ? formatDiDate(graphNode.metadata.arrestDate) : null;
      const placeDate = [graphNode.metadata.province, date && date !== "ไม่มีข้อมูล" ? date : null].filter(Boolean).join(" • ");
      const people = neighborCounts.PERSON > 0 ? countLabel(t("di.network.cardCasePeople"), neighborCounts.PERSON) : null;
      return [placeDate || card.subtitle, people].filter(Boolean).join(" · ") || null;
    }
    if (graphNode.type === "LOCATION") return card.subtitle;
    if (graphNode.type === "DEVICE" || graphNode.type === "SIM") return card.subtitle;
    return card.subtitle;
  }

  function cardStats(): string | null {
    if (graphNode.type !== "PERSON" || isCompact) return null;
    const parts = [
      neighborCounts.PHONE > 0 ? countLabel(t("di.network.cardPhoneStat"), neighborCounts.PHONE) : null,
      neighborCounts.VEHICLE > 0 ? countLabel(t("di.network.cardVehicleStat"), neighborCounts.VEHICLE) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("   ") : null;
  }

  const widthClass =
    graphNode.type === "LOCATION"
      ? isFocus ? "w-[196px]" : "w-[176px]"
      : graphNode.type === "PERSON"
        ? isFocus ? "w-[276px]" : "w-[236px]"
        : graphNode.type === "VEHICLE"
          ? "w-[236px]"
          : "w-[220px]";

  return (
    <div
      role="button"
      tabIndex={0}
      title={card.titleTitle}
      aria-label={`${t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[graphNode.type] as TranslationKey)}: ${title}${isFocus ? ` (${focusCaption})` : ""}${selected ? ` (${t("di.network.selectedNode")})` : ""}${pinned ? ` (${t("di.network.pinnedNode")})` : ""}${isShared ? ` (${sharedCaption})` : ""}${compareSlot ? ` (${compareSlot})` : ""}${compareJunctionNode ? ` (${t("di.network.compareJunctionBadge")})` : ""}`}
      data-compare-role={compareRole ?? undefined}
      data-compare-slot={compareSlot ?? undefined}
      data-compare-junction={compareJunctionNode ? "true" : undefined}
      data-compare-inspect={compareInspect ? "true" : undefined}
      data-testid="network-intelligence-card"
      data-entity-type={graphNode.type}
      className={cn(
        "relative rounded-xl border border-border border-l-4 bg-surface text-left text-foreground shadow-md transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        CARD_ACCENT[graphNode.type],
        isCompact ? "w-[168px] px-2 py-1.5" : cn(widthClass, isFocus ? "px-3 py-2.5" : "px-2.5 py-2"),
        isFocus ? "shadow-lg ring-2 ring-critical ring-offset-2 ring-offset-background" : "",
        selected && !isFocus ? "ring-2 ring-accent ring-offset-2 ring-offset-background shadow-md" : "",
        compareEndpoint && !selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background shadow-md" : "",
        compareInspect && !isFocus ? "ring-2 ring-accent ring-offset-4 ring-offset-background shadow-md" : "",
        compareJunctionNode && !selected && !compareEndpoint ? "ring-2 ring-warning ring-offset-1 ring-offset-background shadow-md" : "",
        comparePath && !selected && !compareEndpoint && !compareJunctionNode ? "ring-1 ring-accent" : "",
        // DI-8.7 V1.5B VISUAL HOTFIX: temporalFocused gets its OWN strong
        // accent ring — visibly bolder than the ordinary onSelectedPath
        // ring-1/40 tier, so a matching CASE (and the entities directly
        // connected to it) is obvious within a couple of seconds. Never a
        // danger/risk color — same accent/orange C-INTEL token every other
        // emphasis tier already uses.
        temporalFocused && !selected && !isFocus ? "ring-2 ring-accent ring-offset-2 ring-offset-background shadow-md" : "",
        onSelectedPath && !temporalFocused && !selected && !isFocus && !compareEndpoint && !comparePath ? "ring-1 ring-accent/40" : "",
        // temporalContextDimmed uses a much stronger, dedicated opacity tier
        // (CARD_GRAPH_TEMPORAL_CONTEXT_OPACITY = 0.22) than the ordinary
        // stronglyDimmed/dimmed tiers (0.55/0.62) — those read as barely
        // different from full network view; this one is unambiguous.
        temporalContextDimmed ? "opacity-[0.22]" : stronglyDimmed ? "opacity-[0.55]" : dimmed ? "opacity-[0.62]" : ""
      )}
    >
      {compareSlot ? (
        <span
          className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-accent bg-accent px-1 text-[10px] font-bold text-surface shadow-sm"
          data-testid={`network-compare-slot-${compareSlot}`}
        >
          {compareSlot}
        </span>
      ) : null}
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
      {pinned ? (
        <span
          title={t("di.network.pinnedNode")}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-sm"
        >
          <Pin className="h-3 w-3 shrink-0" aria-hidden="true" />
        </span>
      ) : null}

      <div className={cn("flex items-start gap-2", isCompact ? "gap-1.5" : "gap-2.5")}>
        {graphNode.type === "PERSON" || (graphNode.type === "VEHICLE" && graphNode.visual?.thumbnailUrl) ? (
          <DrugEntityVisualThumb
            entityType={graphNode.type}
            label={title}
            thumbnailUrl={graphNode.visual?.thumbnailUrl}
            size={graphNode.type === "VEHICLE" ? "graphCard" : photoSize}
            rounded={graphNode.type === "PERSON" ? "full" : "md"}
          />
        ) : (
          <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-bg", ICON_TONE[graphNode.type])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <p className={cn("min-w-0 flex-1 truncate leading-tight text-foreground", isFocus ? "text-base font-bold" : "text-sm font-semibold")}>{title}</p>
            {hasRisk ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" /> : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">{t(typeKey as TranslationKey)}</p>
          {isFocus ? <p className="mt-0.5 truncate text-[11px] font-semibold text-critical">{focusCaption}</p> : null}
          {!isCompact && summary ? <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-foreground">{summary}</p> : null}
          {!isCompact && graphNode.type === "VEHICLE" && card.subtitle && summary !== card.subtitle ? (
            <p className="mt-0.5 truncate text-[12px] text-muted">{card.subtitle}</p>
          ) : null}
          {stats ? <p className="mt-1 truncate text-[11px] text-muted">{stats}</p> : null}
          {pinned ? <span className="mt-1 block text-[10px] font-semibold text-accent">{t("di.network.pinnedNode")}</span> : null}
          {showHopBadge && hopDistance >= 1 ? (
            <span className="mt-1 inline-flex rounded-full bg-neutral-bg px-1.5 py-px text-[10px] font-medium text-muted">
              {t(hopBadgeKey)}
            </span>
          ) : null}
          {viaCaption && !isCompact ? (
            <span
              className="mt-1 block truncate text-[10px] font-medium text-accent"
              title={viaCaption}
              data-testid="network-card-via-hint"
            >
              {viaCaption}
              {pathViaMoreCount > 0
                ? ` ${t("di.network.pathViaMore").replace("{count}", String(pathViaMoreCount))}`
                : ""}
            </span>
          ) : null}
          {compareJunctionNode ? (
            <span
              className="mt-1 inline-flex rounded-full bg-warning-bg px-1.5 py-px text-[10px] font-semibold text-warning"
              data-testid="network-compare-junction-badge"
            >
              {t("di.network.compareJunctionBadge")}
            </span>
          ) : null}
          {isShared ? (
            <span
              title={`${t("di.network.sharedLinkPrefix")} ${graphNode.caseCount} ${t("di.network.summaryCases")}`}
              className="mt-1 inline-flex rounded-full bg-warning-bg px-1.5 py-px text-[10px] font-semibold text-warning"
            >
              {sharedCaption}
            </span>
          ) : null}
        </div>
      </div>

      {canExpand && onExpand ? (
        <button
          type="button"
          className="nodrag nopan absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold leading-none text-foreground shadow-sm hover:bg-neutral-bg"
          aria-label={t("di.network.expandNode")}
          title={t("di.network.expandCard")}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onExpand();
          }}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
