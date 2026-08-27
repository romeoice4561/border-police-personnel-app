/**
 * Seized-item analytics domain contract (Phase DI-3.1, Section 9).
 *
 * A small, pure, framework-agnostic helper layer a future Commander
 * Dashboard (DI-8) can consume directly — canonical category + Thai/English
 * label + measurement kind + normalized COUNT/MASS values + gram↔kilogram
 * presentation conversion. Deliberately NOT a dashboard: no queries, no
 * grouping/rollup logic, no charts, no ranking. DI-8 builds those on top of
 * this contract; this file only defines what one seized-item row means.
 *
 * Pure data — no I/O, no React.
 */

import { DRUG_CATEGORY_LABELS, DRUG_MEASUREMENT_KIND_LABELS, type DrugCategory, type DrugMeasurementKind } from "@/lib/drug_intelligence/drug_seized_item_options";

const GRAMS_PER_KILOGRAM = 1000;

/** Converts a canonical gram amount to kilograms for display — the ONLY direction this module converts; grams remain the sole persisted mass unit (schema doc comment on DrugSeizedItem.weightGrams). */
export function gramsToKilograms(grams: number): number {
  return grams / GRAMS_PER_KILOGRAM;
}

/** Converts a user-entered kilogram amount to grams before persistence — the boundary conversion the Create Case UI/API must apply so weightGrams is always stored in the single canonical unit. */
export function kilogramsToGrams(kilograms: number): number {
  return kilograms * GRAMS_PER_KILOGRAM;
}

export interface DrugSeizedItemAnalyticsFacts {
  drugCategory: DrugCategory;
  /** Populated only when drugCategory = OTHER — never itself an aggregation key. */
  otherDrugCategoryLabel: string | null;
  measurementKind: DrugMeasurementKind;
  /** Present when measurementKind = COUNT; the value to sum for count-based aggregation. */
  normalizedCount: number | null;
  /** Present when measurementKind = MASS; ALWAYS grams — the value to sum for mass-based aggregation. */
  normalizedWeightGrams: number | null;
  /**
   * Evidence-as-recorded display unit for COUNT rows (เม็ด, ขวด, มล., ซอง, …).
   * Optional so existing callers that only had quantity/weight still compile;
   * when present it is the SAME `DrugSeizedItem.unit` Case Workspace and
   * Timeline already render — never invented, never replaced with "รายการ".
   */
  displayUnit?: string | null;
}

export interface DrugSeizedItemAnalyticsView extends DrugSeizedItemAnalyticsFacts {
  categoryLabelTh: string;
  categoryLabelEn: string;
  measurementKindLabelTh: string;
  measurementKindLabelEn: string;
  /** Convenience presentation value — normalizedWeightGrams / 1000, or null for a COUNT row. */
  normalizedWeightKilograms: number | null;
}

/**
 * Resolves the display-ready analytics view for one seized-item row. Never
 * infers measurementKind from a display string — callers pass the already
 * -persisted canonical fields. A DI-8 dashboard aggregates COUNT rows via
 * `normalizedCount` and MASS rows via `normalizedWeightGrams`/
 * `normalizedWeightKilograms` — the two are never summed together.
 */
export function resolveDrugSeizedItemAnalyticsView(facts: DrugSeizedItemAnalyticsFacts): DrugSeizedItemAnalyticsView {
  const categoryLabels = DRUG_CATEGORY_LABELS[facts.drugCategory];
  const kindLabels = DRUG_MEASUREMENT_KIND_LABELS[facts.measurementKind];
  return {
    ...facts,
    categoryLabelTh: categoryLabels.labelTh,
    categoryLabelEn: categoryLabels.labelEn,
    measurementKindLabelTh: kindLabels.labelTh,
    measurementKindLabelEn: kindLabels.labelEn,
    normalizedWeightKilograms: facts.normalizedWeightGrams !== null ? gramsToKilograms(facts.normalizedWeightGrams) : null,
  };
}

/**
 * Canonical Thai quantity/unit line used by Map, officer performance, and
 * any future commander rollup. Matches Case Workspace / Timeline:
 *   COUNT + stored unit → "ยาบ้า 5,000 เม็ด"
 *   MASS                → "ไอซ์ 2.5 กก."  (grams→kg is the only conversion)
 * Never substitutes a generic "รายการ" when a real unit exists, and never
 * invents a unit when none was stored.
 */
export function formatSeizedItemDisplayTh(args: {
  categoryLabelTh: string;
  measurementKind: DrugMeasurementKind;
  normalizedCount: number | null;
  normalizedWeightKilograms: number | null;
  displayUnit?: string | null;
}): string {
  if (args.measurementKind === "COUNT" && args.normalizedCount !== null) {
    const qty = args.normalizedCount.toLocaleString("th-TH");
    const unit = args.displayUnit?.trim();
    return unit ? `${args.categoryLabelTh} ${qty} ${unit}` : `${args.categoryLabelTh} ${qty}`;
  }
  if (args.measurementKind === "MASS" && args.normalizedWeightKilograms !== null) {
    const kg = args.normalizedWeightKilograms.toLocaleString("th-TH", { maximumFractionDigits: 2 });
    return `${args.categoryLabelTh} ${kg} กก.`;
  }
  return args.categoryLabelTh;
}
