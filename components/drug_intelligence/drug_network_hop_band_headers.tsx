/**
 * Presentation-only hop-band headings for depth-2 BY_DEPTH layout.
 * Overlays, not graph nodes.
 */
"use client";

import { useViewport } from "@xyflow/react";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { GroupByHopBandHeader, GroupByHopTypeHeader } from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function DrugNetworkHopBandHeaders({
  bands,
  typeHeaders,
}: {
  bands: GroupByHopBandHeader[];
  typeHeaders: GroupByHopTypeHeader[];
}) {
  const { x, y, zoom } = useViewport();
  const { t } = useT();
  if (bands.length === 0 && typeHeaders.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden="true">
      {bands.map((band) => (
        <div
          key={`band-${band.hop}`}
          className="absolute whitespace-nowrap rounded-md border border-border bg-surface/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-foreground shadow-sm"
          style={{
            transform: `translate(${x + band.x * zoom}px, ${y + band.y * zoom}px) translate(-50%, -50%)`,
          }}
        >
          {band.hop === 1 ? t("di.network.hopBandOne") : t("di.network.hopBandTwo")}
        </div>
      ))}
      {typeHeaders.map((header) => (
        <div
          key={`${header.hop}-${header.type}`}
          className="absolute whitespace-nowrap rounded-md border border-border/70 bg-surface/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted shadow-sm"
          style={{
            transform: `translate(${x + header.x * zoom}px, ${y + header.y * zoom}px) translate(-50%, -50%)`,
          }}
        >
          {t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[header.type] as TranslationKey)} {header.count}
        </div>
      ))}
    </div>
  );
}
