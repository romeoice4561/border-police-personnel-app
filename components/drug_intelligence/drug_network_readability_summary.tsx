/**
 * Compact commander-facing graph summary. Counts come from the already-
 * loaded neighborhood payload — no extra requests.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { READABLE_TYPE_ORDER, type GraphReadabilitySummary } from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function typeCounts(byType: GraphReadabilitySummary["directByType"], t: (key: TranslationKey) => string): string[] {
  return READABLE_TYPE_ORDER
    .filter((type) => (byType[type] ?? 0) > 0)
    .map((type) => `${byType[type]} ${t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[type] as TranslationKey)}`);
}

export function DrugNetworkReadabilitySummary({
  summary,
  depth = 1,
}: {
  summary: GraphReadabilitySummary;
  depth?: 1 | 2;
}) {
  const { t } = useT();
  const directParts = typeCounts(summary.directByType, t);
  const indirectParts = typeCounts(summary.indirectByType, t);
  const showHopSummary = depth === 2 || summary.indirectTotal > 0;

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("di.network.analyzingHeading")}</p>
      <p className="mt-0.5 font-semibold text-foreground">
        {summary.focusLabel}
        {summary.focusSecondaryLabel ? <span className="ml-2 text-sm font-normal text-muted">{summary.focusSecondaryLabel}</span> : null}
      </p>
      {showHopSummary ? (
        <>
          <p className="mt-2 text-xs text-foreground">
            <span className="font-medium text-muted">{t("di.network.hopBandOne")}</span>
            {" · "}
            {directParts.length > 0 ? directParts.join(" · ") : t("di.network.directLinksNone")}
          </p>
          {summary.indirectTotal > 0 ? (
            <p className="mt-1 text-xs text-foreground">
              <span className="font-medium text-muted">{t("di.network.hopBandTwo")}</span>
              {" · "}
              {indirectParts.join(" · ")}
            </p>
          ) : null}
          {depth === 2 ? <p className="mt-2 text-xs text-muted">{t("di.network.hopTwoExplanation")}</p> : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-foreground">
          <span className="font-medium text-muted">{t("di.network.directLinksHeading")}</span>{" "}
          {directParts.length > 0 ? directParts.join(" · ") : t("di.network.directLinksNone")}
        </p>
      )}
    </div>
  );
}
