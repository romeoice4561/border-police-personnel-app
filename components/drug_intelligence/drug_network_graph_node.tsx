/**
 * Custom @xyflow/react node renderer for the DI-5 Network canvas (Section
 * 8). Visual distinction by entity type uses icon + shape + text together
 * — never color alone (Section 8's explicit requirement).
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Pin } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_ENTITY_ICON } from "@/components/drug_intelligence/drug_entity_visual";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { formatGraphNodeCard } from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugNetworkFlowNodeData } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const NODE_ICON = DRUG_ENTITY_ICON;

const NODE_SHAPE: Record<DrugGraphNodeType, string> = {
  PERSON: "rounded-full",
  CASE: "rounded-md",
  PHONE: "rounded-xl",
  SIM: "rounded-xl",
  DEVICE: "rounded-xl",
  VEHICLE: "rounded-xl",
  LOCATION: "rounded-xl",
};

const NODE_TONE: Record<DrugGraphNodeType, string> = {
  PERSON: "border-accent bg-accent/10 text-accent",
  CASE: "border-critical bg-critical-bg text-critical",
  PHONE: "border-good bg-good-bg text-good",
  SIM: "border-good bg-good-bg text-good",
  DEVICE: "border-warning bg-warning-bg text-warning",
  VEHICLE: "border-serious bg-serious-bg text-serious",
  LOCATION: "border-neutral bg-neutral-bg text-neutral",
};

export function DrugNetworkGraphNode({ data, selected }: NodeProps & { data: DrugNetworkFlowNodeData }) {
  const { graphNode, isFocus, density, dimmed, pinned, hopDistance, isShared, onSelectedPath, showHopBadge, stronglyDimmed } = data;
  const { t } = useT();
  const Icon = NODE_ICON[graphNode.type];
  const hasRisk = graphNode.riskIndicators.length > 0;
  const isCompact = density === "COMPACT";
  const card = formatGraphNodeCard(graphNode);
  const isIndirect = hopDistance >= 2;
  const focusCaption = graphNode.type === "PERSON" && isFocus ? t("di.network.focusPerson") : t("di.network.focusNode");
  const sharedCaption = graphNode.caseCount > 2
    ? `${t("di.network.sharedLinkPrefix")} ${graphNode.caseCount} ${t("di.network.summaryCases")}`
    : t("di.network.sharedManyCases");

  return (
    <div
      role="button"
      tabIndex={0}
      title={card.titleTitle}
      aria-label={`${t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[graphNode.type] as TranslationKey)}: ${card.title}${isFocus ? ` (${focusCaption})` : ""}${selected ? ` (${t("di.network.selectedNode")})` : ""}${pinned ? ` (${t("di.network.pinnedNode")})` : ""}${isShared ? ` (${sharedCaption})` : ""}`}
      className={cn(
        "relative flex min-w-[120px] max-w-[180px] flex-col items-center gap-1 border-2 bg-surface px-3 py-2 text-center shadow-sm transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isCompact ? "min-w-20 max-w-30 px-2 py-1.5" : "",
        isFocus ? "min-w-[168px] max-w-[240px] px-4 py-3 shadow-lg outline-2 outline-offset-2 outline-critical" : "",
        isFocus && graphNode.type === "PERSON" ? "rounded-2xl" : NODE_SHAPE[graphNode.type],
        NODE_TONE[graphNode.type],
        selected && !isFocus ? "ring-2 ring-accent ring-offset-2 shadow-md" : "",
        onSelectedPath && !selected && !isFocus ? "ring-1 ring-accent/40" : "",
        isIndirect && !isFocus && !selected && !onSelectedPath ? "opacity-80" : "",
        isIndirect && !isFocus && !selected ? "scale-[0.92] border-dashed" : "",
        stronglyDimmed ? "opacity-[0.08]" : dimmed ? "opacity-20" : ""
      )}
    >
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
      <div className="flex items-center gap-1.5">
        <Icon className={cn("shrink-0", isFocus ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
        {hasRisk ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" /> : null}
      </div>
      <p className={cn("line-clamp-2 font-semibold leading-tight text-foreground", isFocus ? "text-sm" : "text-xs")}>{card.title}</p>
      {!isCompact && card.subtitle ? <p className="line-clamp-1 text-[10px] leading-tight text-muted">{card.subtitle}</p> : null}
      {!isCompact ? (
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[graphNode.type] as TranslationKey)}</span>
      ) : null}
      {isFocus ? <span className="text-[9px] font-semibold uppercase tracking-wide text-critical">{focusCaption}</span> : null}
      {showHopBadge && hopDistance === 1 ? (
        <span className="rounded-full bg-neutral-bg px-1.5 py-px text-[9px] font-medium text-muted">{t("di.network.hopBadgeOne")}</span>
      ) : null}
      {showHopBadge && hopDistance >= 2 ? (
        <span className="rounded-full bg-neutral-bg px-1.5 py-px text-[9px] font-medium text-muted">{t("di.network.hopBadgeTwo")}</span>
      ) : null}
      {selected && !isFocus ? <span className="text-[9px] font-semibold uppercase tracking-wide text-accent">{t("di.network.selectedNode")}</span> : null}
      {isShared ? (
        <span
          title={`${t("di.network.sharedLinkPrefix")} ${graphNode.caseCount} ${t("di.network.summaryCases")}`}
          className="rounded-full bg-warning-bg px-1.5 py-px text-[9px] font-semibold text-warning"
        >
          {sharedCaption}
        </span>
      ) : null}
      {pinned ? <span className="text-[9px] font-semibold uppercase tracking-wide text-accent">{t("di.network.pinnedNode")}</span> : null}
    </div>
  );
}
