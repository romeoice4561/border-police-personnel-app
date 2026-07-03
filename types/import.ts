/**
 * Shared types for the Import Orchestrator (Phase 3).
 *
 * Pure domain typing — no Google Drive SDK, no database, no API, no UI.
 * These types describe an ImportJob as it flows through:
 * Scanner -> Queue -> Scheduler -> Worker -> Layout Detector -> Vision
 * Extractor -> Validator -> Normalizer -> JSON.
 */

import type { TemplateDetectionResult } from "@/lib/layout/layout_types";
import type { PersonnelExtraction, ValidationResult } from "@/lib/types/vision";

/** Lifecycle status of an ImportJob. See docs/IMPORT_STATE_MACHINE.md for the full state diagram. */
export type ImportJobStatus =
  | "Pending"
  | "Queued"
  | "Processing"
  | "Vision"
  | "Parsing"
  | "Validating"
  | "Completed"
  | "Failed"
  | "Retrying"
  | "Cancelled";

/** Relative processing priority. Higher runs first within the scheduler. */
export type ImportJobPriority = "low" | "normal" | "high" | "urgent";

/**
 * A single unit of import work: one source image progressing through the
 * pipeline to a final structured JSON record (or failure).
 */
export interface ImportJob {
  id: string;
  filename: string;
  /** Content hash of the source image, used for dedup and idempotency. */
  hash: string;
  status: ImportJobStatus;
  priority: ImportJobPriority;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  retry_count: number;
  /** Detected template id, populated once the Layout Detector stage runs. */
  template?: string;
  /** Overall confidence score (0-100), populated once Vision/Validation runs. */
  confidence?: number;
  /** Reason for the most recent failure, if any. */
  last_error?: string;
}

/** Input describing a source image discovered by a Scanner, prior to job creation. */
export interface ScannedImage {
  filename: string;
  hash: string;
  source: string;
}

/** Successful terminal output of a completed job. */
export interface ImportJobSuccess {
  job: ImportJob;
  detection: TemplateDetectionResult;
  extraction: PersonnelExtraction;
  validation: ValidationResult;
}

/** Failure terminal output of a job that could not complete. */
export interface ImportJobFailure {
  job: ImportJob;
  error: string;
  stage: ImportJobStatus;
}

/** Discriminated result of running a single job through the pipeline. */
export type ImportJobResult =
  | { outcome: "success"; success: ImportJobSuccess }
  | { outcome: "failure"; failure: ImportJobFailure };

/** Aggregate result of running a batch of jobs. */
export interface BatchResult {
  batchId: string;
  total: number;
  succeeded: number;
  failed: number;
  results: ImportJobResult[];
  startedAt: string;
  finishedAt: string;
}

/** Snapshot of pipeline-wide metrics. See lib/import/import_metrics.ts. */
export interface ImportMetricsSnapshot {
  imagesProcessed: number;
  averageDurationMs: number;
  validationFailures: number;
  templateDistribution: Record<string, number>;
  averageConfidence: number;
}
