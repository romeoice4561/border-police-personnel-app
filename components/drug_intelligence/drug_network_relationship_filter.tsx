/**
 * Relationship-type filter panel (Phase DI-5.1, Section 4).
 *
 * The service/API/URL contract already supported `relationshipTypes` since
 * DI-5 — this component is the missing UI control. Grouped into Direct vs
 * Inferred exactly per spec, multi-select via plain checkboxes (no
 * checkbox primitive exists yet in the shared UI kit, matching Select's own
 * "browser control dressed with Tailwind" precedent rather than inventing
 * a new dependency for one filter). Never recomputes graph semantics
 * client-side — every change is handed to the parent, which re-requests
 * the bounded server neighborhood.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";
import {
  DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES,
  DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES,
  DRUG_GRAPH_RELATIONSHIP_LABEL_KEY,
} from "@/lib/drug_intelligence/drug_network_graph_client_labels";
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

  function toggle(type: DrugGraphRelationshipType) {
    const next = new Set(selectedSet);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next.size > 0 ? [...next] : undefined);
  }

  return (
    <div className="space-y-3">
      <RelationshipGroup
        titleKey="di.network.filterRelationshipTypesDirect"
        badgeTone="accent"
        types={DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES}
        selectedSet={selectedSet}
        onToggle={toggle}
      />
      <RelationshipGroup
        titleKey="di.network.filterRelationshipTypesInferred"
        badgeTone="warning"
        types={DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES}
        selectedSet={selectedSet}
        onToggle={toggle}
      />
      {selectedSet.size > 0 ? (
        <button type="button" onClick={() => onChange(undefined)} className="text-xs text-accent hover:underline">
          {t("di.network.clearFilters")}
        </button>
      ) : null}
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
          return (
            <label key={type} htmlFor={inputId} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-foreground hover:bg-neutral-bg">
              <input
                id={inputId}
                type="checkbox"
                checked={selectedSet.has(type)}
                onChange={() => onToggle(type)}
                className="h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[type] as TranslationKey)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
