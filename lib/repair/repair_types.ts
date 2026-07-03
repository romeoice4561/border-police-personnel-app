/**
 * Shared types for the AI Output Repair Engine (Phase 10C).
 *
 * The Repair Engine sits between OpenAI extraction and Validation:
 *   OpenAI -> Repair Engine -> Validation -> Normalization -> Career Engine
 *
 * Its sole job is to make a raw extraction *legitimately* pass validation by
 * cleaning what the model already produced — NEVER by inventing facts. It may
 * only normalize, reformat, convert, trim, merge, deduplicate, remove invalid
 * values, and convert impossible values to null. It must never guess a
 * missing rank/name/unit/year, fabricate timeline entries, or infer career
 * history.
 *
 * Pure domain typing only — no OCR, no OpenAI, no I/O, no Validation/
 * Normalization/Career imports. The engine (repair_engine.ts) reuses the
 * existing pure normalization converters; the Validation/Normalization/Career
 * engines themselves are untouched.
 */

import type { PersonnelExtraction, ValidationResult } from "@/lib/types/vision";

/** The kinds of repair the engine is permitted to perform (reporting/statistics keys). */
export type RepairType =
  | "thai_numeral_to_arabic"
  | "phone_reformat"
  | "phone_dedup"
  | "year_reformat"
  | "blank_to_null"
  | "whitespace_trim"
  | "collapse_spaces"
  | "dash_normalize"
  | "timeline_remove_empty"
  | "timeline_dedup"
  | "timeline_reorder"
  | "empty_array_normalize";

/** One repair action actually applied, for the RepairReport / statistics. */
export interface RepairAction {
  type: RepairType;
  /** Dotted field path the repair touched, e.g. "phone" or "timeline[1].year". */
  field: string;
  /** Human-readable before → after, e.g. '"0815407336" → "081-540-7336"'. Never includes invented content. */
  detail: string;
}

/**
 * A single field-repair contract: given a value, return the repaired value
 * plus any actions taken. Pure — never mutates input, never invents.
 */
export interface FieldRepair<TInput, TOutput> {
  repair(input: TInput, field: string): { value: TOutput; actions: RepairAction[] };
}

/**
 * Per-image repair outcome, exactly as Phase 10C requires: the actions
 * applied, validation before vs. after repair, and any warnings carried
 * through from validation.
 */
export interface RepairReport {
  repairsApplied: RepairAction[];
  beforeValidation: ValidationResult;
  afterValidation: ValidationResult;
  warnings: string[];
}

/** Result of repairing one extraction: the repaired data plus its report. */
export interface RepairOutcome {
  repaired: PersonnelExtraction;
  report: RepairReport;
}

/** Contract for the top-level Repair Engine, so it stays injectable and testable. */
export interface RepairEngine {
  /**
   * Repairs a raw extraction and reports what changed. Takes the
   * before-repair validation result (computed by the caller with the
   * existing, unmodified validator) and returns the after-repair validation
   * so the report captures the recovery.
   */
  repair(extraction: PersonnelExtraction, beforeValidation: ValidationResult): RepairOutcome;
}
