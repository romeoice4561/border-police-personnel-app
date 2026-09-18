/**
 * Presentation-only type-lane headings for GROUP_BY_TYPE. These are canvas
 * overlays, not graph nodes — they never enter the neighborhood payload.
 * Positions come from the planned GROUP_BY_TYPE layout, not live node
 * bounding boxes, so dragging a node must not move these headings.
 */
"use client";

import { useViewport } from "@xyflow/react";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { GroupByTypeLaneHeader } from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function DrugNetworkTypeLaneHeaders({ headers }: { headers: GroupByTypeLaneHeader[] }) {
  const { x, y, zoom } = useViewport();
  const { t } = useT();
  if (headers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden="true">
      {headers.map((lane) => (
        <div
          key={lane.type}
          className="absolute whitespace-nowrap rounded-md border border-border bg-neutral-bg px-2 py-0.5 text-[10px] font-semibold tracking-wide text-foreground shadow-sm"
          style={{
            transform: `translate(${x + lane.x * zoom}px, ${y + lane.y * zoom}px) translate(-50%, -50%)`,
          }}
        >
          {t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[lane.type] as TranslationKey)} {lane.hop1Count}
        </div>
      ))}
    </div>
  );
}
