/**
 * Entity picker (DI-5 + Phase 1B.2.2 guided selection).
 * Reuses Global Search — typed text is never treated as a selected entity.
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { Loader2, Search } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDrugSearchGrouped } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import {
  flattenSearchResults,
  shouldAutoConfirmExactMatch,
} from "@/lib/drug_intelligence/drug_relationship_search_readiness";
import type {
  DrugGraphNodeType,
  DrugSearchEntityType,
  DrugSearchMatchedField,
  DrugSearchResult,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export interface DrugNetworkEntitySelection {
  entityType: DrugGraphNodeType;
  entityId: string;
  label: string;
  /** Original typed query — presentation/query context only (Phase 1B.2.3). */
  queryText?: string;
  /** Authoritative Search match field when available. */
  matchedField?: DrugSearchMatchedField;
  /** Policy-masked matched value from Search when available. */
  matchedValueMasked?: string;
}

const DEBOUNCE_MS = 300;

function toSelection(result: DrugSearchResult, queryText?: string): DrugNetworkEntitySelection {
  return {
    entityType: result.entityType as DrugGraphNodeType,
    entityId: result.canonicalTarget?.entityId ?? result.entityId,
    label: result.canonicalTarget?.primaryLabel ?? result.primaryLabel,
    queryText: queryText?.trim() || undefined,
    matchedField: result.matchedField,
    matchedValueMasked: result.matchedValueMasked,
  };
}

export function DrugNetworkEntityPicker({
  onSelect,
  placeholder,
  allowedTypes,
  autoConfirmExact = true,
  autoFocus = false,
  helperText,
  inputRef: externalInputRef,
}: {
  onSelect: (selection: DrugNetworkEntitySelection) => void;
  placeholder?: string;
  /** When set, only these entity types appear in results (MVP source/target pickers). */
  allowedTypes?: DrugGraphNodeType[];
  /** Auto-confirm a single EXACT match (never PARTIAL / multi-hit). */
  autoConfirmExact?: boolean;
  autoFocus?: boolean;
  helperText?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const { user } = useAuth();
  const { t } = useT();
  const listboxId = useId();
  const internalRef = useRef<HTMLInputElement | null>(null);
  const inputRef = externalInputRef ?? internalRef;

  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const autoConfirmedForQuery = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(inputValue.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [inputValue]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus, inputRef]);

  const entityTypeFilter =
    allowedTypes && allowedTypes.length === 1 && allowedTypes[0] !== "LOCATION"
      ? (allowedTypes[0] as DrugSearchEntityType)
      : undefined;

  const search = useDrugSearchGrouped(user?.id ?? null, user?.displayName ?? "", {
    q: debouncedQuery,
    entityType: entityTypeFilter,
  });

  const flatResults = useMemo(() => {
    const allowed = allowedTypes ? new Set(allowedTypes.map(String)) : null;
    return flattenSearchResults(search.data?.groups, allowed);
  }, [search.data, allowedTypes]);

  const highlightIndexSafe =
    flatResults.length === 0 ? 0 : Math.min(highlightIndex, flatResults.length - 1);

  // Exact single-match auto-confirm (UI selection only — never creates entities).
  // Parent replaces this picker with a selected card, so we do not clear local input state here.
  useEffect(() => {
    if (!autoConfirmExact) return;
    if (!debouncedQuery) return;
    if (search.isFetching || search.isPending) return;
    if (!search.data) return;
    if (autoConfirmedForQuery.current === debouncedQuery) return;
    if (!shouldAutoConfirmExactMatch(flatResults)) return;
    autoConfirmedForQuery.current = debouncedQuery;
    onSelectRef.current(toSelection(flatResults[0]!, debouncedQuery));
  }, [autoConfirmExact, debouncedQuery, flatResults, search.data, search.isFetching, search.isPending]);

  function selectAt(index: number) {
    const row = flatResults[index];
    if (!row) return;
    onSelectRef.current(toSelection(row, debouncedQuery || inputValue));
    setInputValue("");
    setDebouncedQuery("");
    setOpen(false);
  }

  const showPanel = Boolean(debouncedQuery) && open !== false;
  const isSearching =
    Boolean(debouncedQuery) && (search.isPending || search.isFetching) && !search.data;
  const isRefreshing = Boolean(debouncedQuery) && (search.isPending || search.isFetching);
  const hasError = Boolean(debouncedQuery) && search.isError;
  const noMatch =
    Boolean(debouncedQuery) &&
    !isRefreshing &&
    !hasError &&
    Boolean(search.data) &&
    flatResults.length === 0;
  const hasMatches = Boolean(debouncedQuery) && flatResults.length > 0;

  return (
    <div className="relative space-y-1.5" data-testid="guided-entity-picker">
      {helperText ? <p className="text-xs text-muted" data-testid="picker-helper">{helperText}</p> : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            autoConfirmedForQuery.current = null;
            setInputValue(e.target.value);
            setHighlightIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!hasMatches) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlightIndex((i) => Math.min(i + 1, flatResults.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              selectAt(highlightIndexSafe);
            }
          }}
          placeholder={placeholder ?? t("di.network.selectEntityPlaceholder")}
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label={placeholder ?? t("di.network.selectEntityPlaceholder")}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showPanel && hasMatches}
          role="combobox"
          data-testid="guided-entity-picker-input"
        />
        {isRefreshing ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {inputValue.trim() && !debouncedQuery ? (
        <p className="text-xs text-muted" data-testid="picker-state-typing">
          {t("di.rel.pickerTypingHint")}
        </p>
      ) : null}

      {isSearching ? (
        <p className="text-xs text-muted" data-testid="picker-state-searching">
          {t("di.rel.pickerSearching")}
        </p>
      ) : null}

      {hasError ? (
        <div
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
          data-testid="picker-state-error"
          role="alert"
        >
          <p className="font-medium">{t("di.rel.pickerErrorTitle")}</p>
          <p className="mt-0.5 text-muted">{t("di.rel.pickerErrorBody")}</p>
        </div>
      ) : null}

      {noMatch ? (
        <div
          className="rounded-lg border border-dashed border-border bg-neutral-bg/40 px-3 py-2.5 text-xs"
          data-testid="picker-state-no-match"
        >
          <p className="font-medium text-foreground">{t("di.rel.pickerNoMatchTitle")}</p>
          <p className="mt-0.5 text-muted">{t("di.rel.pickerNoMatchBody")}</p>
        </div>
      ) : null}

      {showPanel && hasMatches ? (
        <div
          id={listboxId}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
          role="listbox"
          data-testid="picker-match-list"
        >
          <p className="border-b border-border bg-neutral-bg px-3 py-1.5 text-xs font-medium text-foreground">
            {flatResults.length === 1
              ? t("di.rel.pickerFoundOne")
              : t("di.rel.pickerFoundMany").replace("{count}", String(flatResults.length))}
          </p>
          {flatResults.map((result, index) => {
            const typeLabel = t(
              DRUG_GRAPH_NODE_TYPE_LABEL_KEY[result.entityType as DrugGraphNodeType] as TranslationKey
            );
            const active = index === highlightIndexSafe;
            return (
              <button
                key={`${result.entityType}-${result.entityId}`}
                type="button"
                role="option"
                aria-selected={active}
                data-testid={`picker-match-${index}`}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectAt(index)}
                className={[
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                  active ? "bg-accent/10 text-foreground" : "text-foreground hover:bg-neutral-bg",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{result.primaryLabel}</p>
                  <p className="text-xs text-muted">{typeLabel}</p>
                  {result.secondaryLabel ? (
                    <p className="text-xs text-muted">{result.secondaryLabel}</p>
                  ) : null}
                  {result.caseCount > 0 ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {t("di.rel.pickerCaseCount").replace("{count}", String(result.caseCount))}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-md border border-border bg-neutral-bg px-2 py-1 text-[11px] font-medium text-foreground">
                  {t("di.rel.pickerSelectAction")}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
