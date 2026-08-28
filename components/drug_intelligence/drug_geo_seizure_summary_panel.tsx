/**
 * DrugGeoSeizureSummaryPanel (Phase DI-8.2, Section 10) — "ของกลางในพื้นที่ที่เลือก".
 *
 * Presentation only — every number comes from combineDrugGeoSeizureGroups
 * (lib/drug_intelligence/drug_geo_seizure_summary.ts), which itself never
 * re-implements grouping (it combines the per-case groups the map API
 * already returns, produced by groupSeizedItemFacts). COUNT and MASS rows
 * for the same category render as separate list items — never one number.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoSeizureGroup } from "@/lib/drug_intelligence/drug_geo_marker";

export function DrugGeoSeizureSummaryPanel({ groups }: { groups: DrugGeoSeizureGroup[] }) {
  const { t } = useT();

  if (groups.length === 0) {
    return <p className="text-xs text-muted">{t("di.map.seizureSummaryEmpty")}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {groups.map((g) => (
        <li key={`${g.drugCategory}-${g.measurementKind}-${g.displayUnit ?? ""}`} className="text-sm text-foreground">
          {g.displayTh}
        </li>
      ))}
    </ul>
  );
}
