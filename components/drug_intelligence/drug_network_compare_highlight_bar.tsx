/**
 * Compact Compare Highlight explanation bar.
 * Presentation-only; never changes graph queries or invents relationship facts.
 */
"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import {
  buildComparePathExplanation,
  compareHighlightHasC,
  formatCompareConnectingSummary,
  formatCompareHopLine,
  type CompareHighlightSlot,
  type LinkCompareHighlightContext,
} from "@/lib/drug_intelligence/drug_link_compare_highlight";
import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";

function SlotBadge({ slot }: { slot: "A" | "B" | "C" }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-accent bg-accent px-1 text-[10px] font-bold text-surface">
      {slot}
    </span>
  );
}

export function DrugNetworkCompareHighlightBar({
  context,
  emphasize,
  inspectSlot = null,
  nodes = [],
  edges = [],
  onEmphasize,
  onShowAll,
}: {
  context: LinkCompareHighlightContext;
  emphasize: boolean;
  inspectSlot?: CompareHighlightSlot | null;
  nodes?: DrugGraphNode[];
  edges?: Array<Pick<DrugGraphEdge, "source" | "target" | "edgeKind" | "relationshipType">>;
  onEmphasize: () => void;
  onShowAll: () => void;
}) {
  const { t } = useT();
  const three = compareHighlightHasC(context);
  const explanation = buildComparePathExplanation(context, nodes ?? [], edges ?? []);
  const connectingLines = formatCompareConnectingSummary(explanation, t);
  const endpointBySlot = new Map(explanation.endpoints.map((row) => [row.slot, row]));
  const connectingCase = explanation.connectingCases[0] ?? null;
  const inspectEndpoint = inspectSlot ? endpointBySlot.get(inspectSlot) : null;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2"
      data-testid="network-compare-highlight-bar"
      data-compare-highlight={emphasize ? "on" : "off"}
      data-compare-slots={three ? "3" : "2"}
      data-compare-inspect={inspectSlot ?? undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-medium text-foreground">
          {emphasize
            ? t(three ? "di.network.compareHighlightThree" : "di.network.compareHighlightTwo")
            : t(three ? "di.network.compareShowAllThree" : "di.network.compareShowAllTwo")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={emphasize ? "accent" : "outline"}
            onClick={onEmphasize}
            data-testid="network-compare-highlight-on"
            aria-pressed={emphasize}
          >
            {t("di.network.compareHighlightOn")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={emphasize ? "outline" : "accent"}
            onClick={onShowAll}
            data-testid="network-compare-highlight-all"
            aria-pressed={!emphasize}
          >
            {t("di.network.compareHighlightAll")}
          </Button>
        </div>
      </div>
      {inspectEndpoint ? (
        <p className="text-xs text-muted" data-testid="network-compare-inspecting">
          {t("di.network.compareInspecting")
            .replace("{slot}", inspectEndpoint.slot)
            .replace("{label}", inspectEndpoint.label || inspectEndpoint.slot)}
        </p>
      ) : null}

      {emphasize ? (
        <div className="flex flex-col gap-2" data-testid="network-compare-explain">
          <div className="flex flex-col items-stretch gap-1 text-xs" data-testid="network-compare-story">
            <EndpointRow slot="A" label={endpointBySlot.get("A")?.label ?? ""} />
            {connectingCase ? (
              <>
                <p className="text-center text-muted" aria-hidden="true">
                  ↓
                </p>
                <div
                  className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-warning/50 bg-warning-bg px-2 py-1 text-warning"
                  data-testid="network-compare-connecting-case"
                >
                  <span className="rounded-full border border-warning bg-surface px-1.5 py-px text-[9px] font-semibold">
                    {t("di.network.compareJunctionBadge")}
                  </span>
                  <span className="font-semibold">{connectingCase.label || connectingCase.entityId}</span>
                </div>
                {three ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-muted" aria-hidden="true">
                        ↙
                      </p>
                      <EndpointRow slot="B" label={endpointBySlot.get("B")?.label ?? ""} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-muted" aria-hidden="true">
                        ↘
                      </p>
                      <EndpointRow slot="C" label={endpointBySlot.get("C")?.label ?? ""} />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-muted" aria-hidden="true">
                      ↓
                    </p>
                    <EndpointRow slot="B" label={endpointBySlot.get("B")?.label ?? ""} />
                  </>
                )}
              </>
            ) : (
              <>
                {explanation.pairs[0] ? (
                  <p className="text-center text-muted">{formatCompareHopLine(explanation.pairs[0], t)}</p>
                ) : null}
                <EndpointRow slot="B" label={endpointBySlot.get("B")?.label ?? ""} />
                {three ? <EndpointRow slot="C" label={endpointBySlot.get("C")?.label ?? ""} /> : null}
              </>
            )}
          </div>
          {connectingLines.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-foreground" data-testid="network-compare-connecting-summary">
              {connectingLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {explanation.pairs.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-foreground" data-testid="network-compare-pair-list">
              {explanation.pairs.map((pair) => (
                <li key={`${pair.left}-${pair.right}`} data-testid={`network-compare-pair-${pair.left}${pair.right}`}>
                  <span className="font-semibold">
                    {pair.left} ↔ {pair.right}
                  </span>{" "}
                  {formatCompareHopLine(pair, t)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted" data-testid="network-compare-show-all-hint">
          {t("di.network.compareShowAllHint")}
        </p>
      )}
    </div>
  );
}

function EndpointRow({ slot, label }: { slot: "A" | "B" | "C"; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5" data-testid={`network-compare-endpoint-${slot}`}>
      <SlotBadge slot={slot} />
      <span className="font-semibold text-foreground">{label || slot}</span>
    </div>
  );
}
