/**
 * OfficerPicker (Phase DI-7.6, Section 5).
 *
 * "เลือกจากกำลังพล" — a debounced name search over the existing GET /search
 * endpoint (apiClient.searchOfficers), reusing the canonical Officer search
 * this codebase already has rather than duplicating it. Selecting a result
 * returns the officer's STRING business key (officerId) — never Officer's
 * numeric `id` — matching DrugCasePerson.linkedOfficerId's established
 * convention. This component never creates or modifies an Officer record;
 * it only looks one up.
 */
"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiClient, type OfficerSummary } from "@/lib/ui/api_client";
import { useT } from "@/components/i18n/language_provider";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface OfficerPickerProps {
  onSelect: (officer: OfficerSummary) => void;
}

export function OfficerPicker({ onSelect }: OfficerPickerProps) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OfficerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(draft.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.searchOfficers({ name: query, pageSize: 10 });
        if (cancelled) return;
        setResults(res.data);
        setSearched(true);
      } catch {
        if (cancelled) return;
        setResults([]);
        setSearched(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Derived at render time (not via a resetting effect) — a too-short query
  // simply shows no results/no "searched" state without needing setState
  // calls in the effect body (react-hooks/set-state-in-effect).
  const belowMinLength = query.length < MIN_QUERY_LENGTH;
  const visibleResults = belowMinLength ? [] : results;
  const visibleSearched = !belowMinLength && searched;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("di.arrestTeam.searchPlaceholder")}
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      {draft.trim().length > 0 && draft.trim().length < MIN_QUERY_LENGTH ? (
        <p className="text-xs text-muted">{t("di.arrestTeam.searchHelperText")}</p>
      ) : null}
      {loading ? <p className="text-xs text-muted">{t("common.loading")}</p> : null}
      {!loading && visibleSearched && visibleResults.length === 0 ? (
        <p className="text-xs text-muted">{t("di.arrestTeam.noResults")}</p>
      ) : null}
      {visibleResults.length > 0 ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border">
          {visibleResults.map((officer) => (
            <li key={officer.officerId}>
              <button
                type="button"
                onClick={() => onSelect(officer)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <span className="font-medium text-foreground">
                  {officer.rank} {officer.firstName} {officer.lastName}
                </span>
                <span className="text-xs text-muted">
                  {[officer.currentPosition, officer.currentUnit].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
