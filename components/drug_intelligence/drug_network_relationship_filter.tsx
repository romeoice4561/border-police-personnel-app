/**
 * Relationship-type filter panel (Phase DI-5.1, Section 4).
 *
 * Multi-select only. Every change is handed to the parent so URL / board
 * graph context stays the durable store. Does not recompute graph semantics.
 *
 * Rows are real buttons (role=checkbox), not overlaid native inputs,
 * so the label, glyph, and row share one enabled pointer target.
 */
"use client";

import { Check } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/cn";
import {
  DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES,
  DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES,
  DRUG_GRAPH_RELATIONSHIP_LABEL_KEY,
} from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { applyRelationshipFilterControlEvent } from "@/lib/drug_intelligence/drug_network_relationship_filter_state";
import type { DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function DrugNetworkRelationshipFilter({
  selected,
  onChange,
}: {
  selected: DrugGraphRelationshipType[] | undefined;
  onChange: (next: DrugGraphRelationshipType[] | undefined) => void;
}) {
  const { t } = useT();
  const selectedSet = new Set(selected ?? []);
  const selectedCount = selectedSet.size;

  function activate(action: "toggle" | "remove" | "clear", type?: DrugGraphRelationshipType) {
    onChange(applyRelationshipFilterControlEvent(selected, { action, type }));
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs text-muted" data-testid="relationship-filter-summary">
          {selectedCount === 0
            ? t("di.network.relationshipNoneSelected")
            : t("di.network.relationshipSelectedCount").replace("{count}", String(selectedCount))}
        </p>
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {(selected ?? []).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => activate("remove", type)}
                className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs text-accent hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`${t("di.network.removeRelationshipFilter")}: ${t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[type] as TranslationKey)}`}
                data-testid={`relationship-chip-${type}`}
              >
                <span className="min-w-0 truncate">{t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[type] as TranslationKey)}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => activate("clear")}
              className="min-h-8 text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="relationship-filter-clear-all"
            >
              {t("di.network.clearRelationshipFilters")}
            </button>
          </div>
        ) : null}
      </div>
      <RelationshipGroup
        titleKey="di.network.filterRelationshipTypesDirect"
        badgeTone="accent"
        types={DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES}
        selectedSet={selectedSet}
        onToggle={(type) => activate("toggle", type)}
      />
      <RelationshipGroup
        titleKey="di.network.filterRelationshipTypesInferred"
        badgeTone="warning"
        types={DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES}
        selectedSet={selectedSet}
        onToggle={(type) => activate("toggle", type)}
      />
    </div>
  );
}

function RelationshipGroup({
  titleKey,
  badgeTone,
  types,
  selectedSet,
  onToggle,
}: {
  titleKey: TranslationKey;
  badgeTone: "accent" | "warning";
  types: DrugGraphRelationshipType[];
  selectedSet: Set<DrugGraphRelationshipType>;
  onToggle: (type: DrugGraphRelationshipType) => void;
}) {
  const { t } = useT();
  return (
    <fieldset>
      <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Badge tone={badgeTone}>{t(titleKey)}</Badge>
      </legend>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {types.map((type) => {
          const inputId = `drug-network-rel-${type}`;
          const labelId = `${inputId}-label`;
          const checked = selectedSet.has(type);
          return (
            <button
              key={type}
              id={inputId}
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-labelledby={labelId}
              data-testid={`relationship-option-${type}`}
              data-checked={checked ? "true" : "false"}
              onClick={() => onToggle(type)}
              className={cn(
                "flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                checked
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-surface text-foreground hover:bg-neutral-bg"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2",
                  checked ? "border-accent bg-accent text-accent-fg" : "border-border bg-background"
                )}
              >
                <Check
                  className={cn("pointer-events-none h-3.5 w-3.5", checked ? "opacity-100" : "opacity-0")}
                  strokeWidth={3}
                />
              </span>
              <span id={labelId} className="min-w-0 leading-snug">
                {t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[type] as TranslationKey)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
