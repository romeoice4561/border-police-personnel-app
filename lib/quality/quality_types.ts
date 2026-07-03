/**
 * Shared types for the Data Quality Intelligence & Gap Analysis layer
 * (Phase 11B).
 *
 * This layer is READ-ONLY. It analyzes the already-exported personnel records
 * (and the Phase 11A KnowledgeBase built from them) to explain WHY each record
 * passes or fails and to produce actionable quality metrics. It NEVER modifies
 * extracted data and never calls OpenAI/OCR/Google Drive/a database, and it
 * changes no pipeline stage.
 *
 * Pure domain typing only.
 */

/** Quality bands from the phase spec. */
export type QualityCategory = "Excellent" | "Good" | "Fair" | "Poor";

/** The fields whose presence/completeness are scored. */
export type QualityField =
  | "rank"
  | "first_name"
  | "last_name"
  | "position"
  | "unit"
  | "phone"
  | "timeline"
  | "notes"
  | "confidence";

/** Completeness of the individually-scored field groups, each 0-100. */
export interface CompletenessBreakdown {
  /** All nine scored fields present/non-empty. */
  field_completeness: number;
  /** Timeline present, entries complete (year+position), ordered, no empties/dupes. */
  timeline_completeness: number;
  /** rank + first_name + last_name + position + unit present. */
  identity_completeness: number;
  /** Phone present and well-formed (XXX-XXX-XXXX). */
  phone_quality: number;
  /** Career signals present (timeline entries, derivable years, units). */
  career_quality: number;
}

/** A single non-fatal data-quality observation about a record. */
export interface QualityWarning {
  field: string;
  message: string;
}

/** An actionable, read-only recommendation (never an instruction that mutates data). */
export interface QualityRecommendation {
  code: string;
  message: string;
}

/** Per-officer quality assessment — the quality_report.json entry shape. */
export interface OfficerQuality {
  officer_id: string;
  quality_score: number;
  category: QualityCategory;
  completeness: CompletenessBreakdown;
  missing_fields: QualityField[];
  warnings: QualityWarning[];
  recommendations: QualityRecommendation[];
}

/** The logs/quality_summary.json shape. */
export interface QualitySummary {
  total_officers: number;
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  average_quality: number;
  missing_rank: number;
  missing_name: number;
  missing_position: number;
  missing_unit: number;
  missing_phone: number;
  missing_timeline: number;
  duplicate_records: number;
  duplicate_phone: number;
  duplicate_names: number;
}

/** The full quality_report.json shape: one entry per officer. */
export interface QualityReport {
  officers: OfficerQuality[];
}
