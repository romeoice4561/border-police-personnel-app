/**
 * Compact graph legend (Phase DI-5.1, Section 7). Explains node-type
 * icon/shape/color and DIRECT vs INFERRED edge line treatment — never
 * relies on the viewer already knowing the visual language. Collapsible so
 * it never permanently covers the canvas on mobile (Section 7's explicit
 * mobile requirement); starts collapsed on small screens by the caller's
 * own state, not hardcoded here.
 */
"use client";

import { User, Phone, CreditCard, Smartphone, Car, FileSpreadsheet, MapPin } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const LEGEND_NODE_TYPES: DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"];

const NODE_ICON: Record<DrugGraphNodeType, typeof User> = {
  PERSON: User,
  PHONE: Phone,
  SIM: CreditCard,
  DEVICE: Smartphone,
  VEHICLE: Car,
  CASE: FileSpreadsheet,
  LOCATION: MapPin,
};

const NODE_TONE_DOT: Record<DrugGraphNodeType, string> = {
  PERSON: "border-accent bg-accent/10 text-accent",
  CASE: "border-critical bg-critical-bg text-critical",
  PHONE: "border-good bg-good-bg text-good",
  SIM: "border-good bg-good-bg text-good",
  DEVICE: "border-warning bg-warning-bg text-warning",
  VEHICLE: "border-serious bg-serious-bg text-serious",
  LOCATION: "border-neutral bg-neutral-bg text-neutral",
};

export function DrugNetworkLegend() {
  const { t } = useT();
  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted">{t("di.network.legendTitle")}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {LEGEND_NODE_TYPES.map((type) => {
            const Icon = NODE_ICON[type];
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${NODE_TONE_DOT[type]}`}>
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </span>
                <span className="text-foreground">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[type] as TranslationKey)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-1 border-t border-border pt-2">
        <div className="flex items-center gap-1.5">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" className="text-accent" />
          </svg>
          <span className="text-foreground">{t("di.network.legendDirectEdge")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" className="text-warning" />
          </svg>
          <span className="text-foreground">{t("di.network.legendInferredEdge")}</span>
        </div>
      </div>
    </div>
  );
}
