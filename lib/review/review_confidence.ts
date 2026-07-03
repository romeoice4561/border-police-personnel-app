/**
 * ReviewConfidenceAnalyzer
 *
 * Surfaces concerns a human reviewer should look at: low overall
 * confidence, low-confidence fields (when field-level confidence is
 * available), timeline uncertainty (sparse or unparsable years), and
 * missing phone/unit values. Pure analysis over already-extracted data —
 * no AI calls.
 */

import type { FieldConfidence, PersonnelExtraction } from "@/lib/types/vision";
import type { ConfidenceConcern } from "@/lib/review/review_types";

export interface ConfidenceThresholds {
  /** Overall confidence below this triggers `low_overall_confidence`. */
  overallWarning: number;
  overallCritical: number;
  /** Field-level confidence below this triggers `low_field_confidence`. */
  fieldWarning: number;
}

const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  overallWarning: 80,
  overallCritical: 60,
  fieldWarning: 60,
};

/** Contract for confidence review. Allows swapping in different thresholds/rules later. */
export interface ConfidenceReviewEngine {
  analyze(extraction: PersonnelExtraction, fieldConfidence?: FieldConfidence): ConfidenceConcern[];
}

/**
 * Default confidence analyzer using fixed (but configurable) thresholds.
 *
 * Future extension point: per-field configurable thresholds, or
 * template-aware thresholds (some templates may be inherently noisier).
 */
export class DefaultConfidenceReviewEngine implements ConfidenceReviewEngine {
  constructor(private readonly thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS) {}

  analyze(extraction: PersonnelExtraction, fieldConfidence?: FieldConfidence): ConfidenceConcern[] {
    const concerns: ConfidenceConcern[] = [];

    this.checkOverallConfidence(extraction, concerns);
    this.checkFieldConfidence(fieldConfidence, concerns);
    this.checkTimelineUncertainty(extraction, concerns);
    this.checkMissingPhone(extraction, concerns);
    this.checkMissingUnit(extraction, concerns);

    return concerns;
  }

  private checkOverallConfidence(extraction: PersonnelExtraction, concerns: ConfidenceConcern[]): void {
    if (extraction.confidence < this.thresholds.overallCritical) {
      concerns.push({
        type: "low_overall_confidence",
        message: `Overall confidence (${extraction.confidence}%) is below the critical threshold (${this.thresholds.overallCritical}%).`,
        severity: "critical",
      });
    } else if (extraction.confidence < this.thresholds.overallWarning) {
      concerns.push({
        type: "low_overall_confidence",
        message: `Overall confidence (${extraction.confidence}%) is below the warning threshold (${this.thresholds.overallWarning}%).`,
        severity: "warning",
      });
    }
  }

  private checkFieldConfidence(fieldConfidence: FieldConfidence | undefined, concerns: ConfidenceConcern[]): void {
    if (!fieldConfidence) return;

    const fields: Array<keyof Omit<FieldConfidence, "overall">> = ["name", "phone", "timeline"];
    for (const field of fields) {
      if (fieldConfidence[field] < this.thresholds.fieldWarning) {
        concerns.push({
          type: "low_field_confidence",
          field,
          message: `Field "${field}" confidence (${fieldConfidence[field]}%) is below the warning threshold (${this.thresholds.fieldWarning}%).`,
          severity: "warning",
        });
      }
    }
  }

  private checkTimelineUncertainty(extraction: PersonnelExtraction, concerns: ConfidenceConcern[]): void {
    if (extraction.timeline.length === 0) {
      concerns.push({
        type: "timeline_uncertainty",
        field: "timeline",
        message: "No timeline entries were extracted.",
        severity: "warning",
      });
      return;
    }

    const unparsableYears = extraction.timeline.filter((entry) => !/^\d{4}$/.test(entry.year));
    if (unparsableYears.length > 0) {
      concerns.push({
        type: "timeline_uncertainty",
        field: "timeline",
        message: `${unparsableYears.length} timeline entr${unparsableYears.length === 1 ? "y has" : "ies have"} an unparsable or missing year.`,
        severity: "warning",
      });
    }
  }

  private checkMissingPhone(extraction: PersonnelExtraction, concerns: ConfidenceConcern[]): void {
    if (!extraction.phone || extraction.phone.trim().length === 0) {
      concerns.push({
        type: "missing_phone",
        field: "phone",
        message: "Phone number is missing.",
        severity: "info",
      });
    }
  }

  private checkMissingUnit(extraction: PersonnelExtraction, concerns: ConfidenceConcern[]): void {
    if (!extraction.unit || extraction.unit.trim().length === 0) {
      concerns.push({
        type: "missing_unit",
        field: "unit",
        message: "Unit is missing.",
        severity: "warning",
      });
    }
  }
}
