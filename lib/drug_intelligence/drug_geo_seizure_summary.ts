/**
 * Filtered-map-result seizure summary ("ของกลางในพื้นที่ที่เลือก") — Phase
 * DI-8.2, Section 10.
 *
 * The map API already returns each case's seizures PRE-GROUPED per case
 * (DrugGeoSeizureGroup[], produced by groupSeizedItemFacts — see
 * drug_geo_marker.ts) — this module does NOT re-implement that grouping. It
 * only combines the ALREADY-GROUPED per-case groups across every case in
 * the current filtered result, using the exact same composite key
 * (drugCategory :: measurementKind :: displayUnit) groupSeizedItemFacts
 * itself uses, so COUNT and MASS — and different COUNT display units — are
 * never merged into one number, matching the same rule at one more level
 * of aggregation.
 *
 * Pure — no I/O, no React.
 */

import { formatSeizedItemDisplayTh } from "@/lib/drug_intelligence/drug_seized_item_analytics";
import type { DrugGeoSeizureGroup } from "@/lib/drug_intelligence/drug_geo_marker";

/** Sums already-grouped per-case seizure groups (e.g. every marker's seizedItems[]) into ONE combined breakdown for the filtered result set. */
export function combineDrugGeoSeizureGroups(groupLists: DrugGeoSeizureGroup[][]): DrugGeoSeizureGroup[] {
  const combined = new Map<string, DrugGeoSeizureGroup>();

  for (const groups of groupLists) {
    for (const g of groups) {
      const key = `${g.drugCategory}::${g.measurementKind}::${g.displayUnit ?? ""}`;
      const existing = combined.get(key);
      if (existing) {
        if (g.measurementKind === "COUNT" && g.totalCount !== null) {
          existing.totalCount = (existing.totalCount ?? 0) + g.totalCount;
        }
        if (g.measurementKind === "MASS" && g.totalWeightGrams !== null) {
          existing.totalWeightGrams = (existing.totalWeightGrams ?? 0) + g.totalWeightGrams;
          existing.totalWeightKilograms = existing.totalWeightGrams / 1000;
        }
      } else {
        // Always DERIVE totalWeightKilograms from totalWeightGrams here rather
        // than trust the input's own value — keeps this function correct even
        // if a caller ever passes a group whose two fields aren't in sync.
        combined.set(key, { ...g, totalWeightKilograms: g.totalWeightGrams !== null ? g.totalWeightGrams / 1000 : null });
      }
    }
  }

  const result = [...combined.values()];
  for (const g of result) {
    g.displayTh = formatSeizedItemDisplayTh({
      categoryLabelTh: g.categoryLabelTh,
      measurementKind: g.measurementKind,
      normalizedCount: g.totalCount,
      normalizedWeightKilograms: g.totalWeightKilograms,
      displayUnit: g.displayUnit,
    });
  }
  // Largest quantity/weight first within each measurement kind, COUNT before MASS, matching the marker popup's own category-first, deterministic ordering convention.
  return result.sort((a, b) => a.categoryLabelTh.localeCompare(b.categoryLabelTh) || a.measurementKind.localeCompare(b.measurementKind));
}
