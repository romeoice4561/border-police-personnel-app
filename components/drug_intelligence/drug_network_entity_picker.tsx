/**
 * Entity picker (Phase DI-5, Section 13). Reuses DI-3's Global Search
 * (searchGrouped) rather than building a second search engine — types a
 * query, picks one result from the grouped list to select an entity.
 */
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDrugSearchGrouped } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export interface DrugNetworkEntitySelection {
  entityType: DrugGraphNodeType;
  entityId: string;
  label: string;
}

export function DrugNetworkEntityPicker({ onSelect, placeholder }: { onSelect: (selection: DrugNetworkEntitySelection) => void; placeholder?: string }) {
  const { user } = useAuth();
  const { t } = useT();
  const [query, setQuery] = useState("");
  const search = useDrugSearchGrouped(user?.id ?? null, user?.displayName ?? "", { q: query });

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t("di.network.selectEntityPlaceholder")}
          className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      {query.trim() && search.data && search.data.totalCount > 0 ? (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {search.data.groups.map((group) => (
            <div key={group.entityType}>
              <p className="bg-neutral-bg px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[group.entityType as DrugGraphNodeType] as TranslationKey)}</p>
              {group.results.map((result) => (
                <button
                  key={`${result.entityType}-${result.entityId}`}
                  type="button"
                  onClick={() => {
                    onSelect({ entityType: result.entityType as DrugGraphNodeType, entityId: result.canonicalTarget?.entityId ?? result.entityId, label: result.canonicalTarget?.primaryLabel ?? result.primaryLabel });
                    setQuery("");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-neutral-bg"
                >
                  <p className="font-medium">{result.primaryLabel}</p>
                  {result.secondaryLabel ? <p className="text-xs text-muted">{result.secondaryLabel}</p> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
