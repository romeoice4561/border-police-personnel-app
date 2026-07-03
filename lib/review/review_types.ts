/**
 * Shared types for the Human Review layer (Phase 8).
 *
 * Input to this layer is the AI JSON produced by Phase 7's vertical slice
 * (`scripts/sample_output/personnel_result.json` shape) — a
 * PersonnelExtraction plus its CareerIntelligence, ValidationResult, and
 * ProcessingMetadata. This layer never calls AI, never touches a database,
 * and has no UI — it only models the review workflow around that JSON.
 */

import type { CareerIntelligence } from "@/lib/career/career_engine";
import type { PersonnelExtraction, ValidationResult } from "@/lib/types/vision";

/** Mirrors scripts/run_real_import.ts's ProcessingMetadata shape. */
export interface ProcessingMetadata {
  image: string;
  processing_time_ms: number;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  template: string;
  confidence: number;
}

/** The AI-produced result a review session is built around (Phase 7 output). */
export interface AIExtractionResult {
  original_extraction: PersonnelExtraction;
  normalized_extraction: PersonnelExtraction;
  career_intelligence: CareerIntelligence;
  validation: ValidationResult;
  confidence: number;
  processing_metadata: ProcessingMetadata;
}

/** Lifecycle status of a review. See docs/HUMAN_REVIEW.md for the workflow. */
export type ReviewStatus = "Pending" | "Approved" | "Rejected" | "NeedsCorrection";

/** Identifies the human reviewer performing an action. No auth system exists yet — this is a plain label. */
export interface Reviewer {
  id: string;
  name: string;
}

/** A single field-level difference between the AI extraction and the human-edited version. */
export type FieldChangeType = "added" | "removed" | "changed";

export interface FieldDiff {
  field: string;
  type: FieldChangeType;
  before?: unknown;
  after?: unknown;
}

export interface DiffResult {
  added: FieldDiff[];
  removed: FieldDiff[];
  changed: FieldDiff[];
  hasChanges: boolean;
}

/** A confidence concern surfaced for reviewer attention. */
export type ConfidenceConcernType =
  | "low_overall_confidence"
  | "low_field_confidence"
  | "timeline_uncertainty"
  | "missing_phone"
  | "missing_unit";

export interface ConfidenceConcern {
  type: ConfidenceConcernType;
  field?: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

/** A single entry in a review's audit history. */
export interface ReviewHistoryEntry {
  timestamp: string;
  reviewer: Reviewer;
  action: ReviewStatus | "Edited" | "Created";
  changes?: DiffResult;
  note?: string;
}

/**
 * A full review session: the AI result under review, the current
 * human-edited extraction (initially a copy of normalized_extraction),
 * status, concerns, and history.
 */
export interface ReviewSession {
  id: string;
  aiResult: AIExtractionResult;
  editedExtraction: PersonnelExtraction;
  status: ReviewStatus;
  concerns: ConfidenceConcern[];
  history: ReviewHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/** The final package produced for downstream consumption (still no DB — this is a plain object/file). */
export interface ReviewPackage {
  session: ReviewSession;
  diff: DiffResult;
  report: string;
}

/** Aggregate statistics across many review sessions. */
export interface ReviewStatistics {
  totalReviews: number;
  approvalRate: number;
  rejectionRate: number;
  correctionRate: number;
  averageConfidence: number;
}
