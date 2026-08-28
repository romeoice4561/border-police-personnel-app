/**
 * DrugGeoFilterChips (Phase DI-8.2, Section 5) — one removable chip per
 * active map filter. Purely presentational; chip derivation itself lives
 * in lib/drug_intelligence/drug_geo_filter_chips.ts (pure, tested
 * independently of React).
 */
"use client";

import { X } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoFilterChip } from "@/lib/drug_intelligence/drug_geo_filter_chips";
import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";

export function DrugGeoFilterChips({ chips, onRemove }: { chips: DrugGeoFilterChip[]; onRemove: (patch: Partial<DrugGeoFilterState>) => void }) {
  const { t } = useT();

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label={t("di.map.activeFilters")}>
      {chips.map((chip) => (
        <span key={chip.key} role="listitem" className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/5 py-1 pl-2.5 pr-1 text-xs text-accent">
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.clearPatch)}
            className="rounded-full p-0.5 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`${t("di.map.removeFilter")}: ${chip.label}`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
