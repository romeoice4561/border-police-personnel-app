/**
 * Custom @xyflow/react node renderer for the DI-5 Network canvas (Section
 * 8). Visual distinction by entity type uses icon + shape + text together
 * — never color alone (Section 8's explicit requirement).
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Phone, CreditCard, Smartphone, Car, FileSpreadsheet, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugNetworkFlowNodeData } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const NODE_ICON: Record<DrugGraphNodeType, typeof User> = {
  PERSON: User,
  PHONE: Phone,
  SIM: CreditCard,
  DEVICE: Smartphone,
  VEHICLE: Car,
  CASE: FileSpreadsheet,
  LOCATION: MapPin,
};

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
  const { graphNode, isFocus } = data;
  const { t } = useT();
  const Icon = NODE_ICON[graphNode.type];
  const hasRisk = graphNode.riskIndicators.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[graphNode.type] as TranslationKey)}: ${graphNode.label}${isFocus ? ` (${t("di.network.focusNode")})` : ""}${selected ? ` (${t("di.network.selectedNode")})` : ""}`}
      className={cn(
        "flex min-w-[120px] max-w-[180px] flex-col items-center gap-1 border-2 bg-surface px-3 py-2 text-center shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        NODE_SHAPE[graphNode.type],
        NODE_TONE[graphNode.type],
        selected ? "ring-2 ring-accent ring-offset-2" : "",
        isFocus ? "shadow-lg outline-2 outline-offset-2 outline-critical/60" : ""
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {hasRisk ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" /> : null}
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">{graphNode.label}</p>
      {graphNode.secondaryLabel ? <p className="line-clamp-1 text-[10px] leading-tight text-muted">{graphNode.secondaryLabel}</p> : null}
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[graphNode.type] as TranslationKey)}</span>
      {isFocus ? <span className="text-[9px] font-semibold uppercase tracking-wide text-critical">{t("di.network.focusNode")}</span> : null}
    </div>
  );
}
