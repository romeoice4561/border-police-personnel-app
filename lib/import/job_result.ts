/**
 * Helpers for constructing ImportJobResult values.
 *
 * Kept separate from import_worker.ts so the result shape can be built and
 * tested independently of pipeline execution.
 */

import type {
  ImportJob,
  ImportJobFailure,
  ImportJobResult,
  ImportJobStatus,
  ImportJobSuccess,
} from "@/types/import";

export function successResult(success: ImportJobSuccess): ImportJobResult {
  return { outcome: "success", success };
}

export function failureResult(job: ImportJob, error: string, stage: ImportJobStatus): ImportJobResult {
  const failure: ImportJobFailure = { job, error, stage };
  return { outcome: "failure", failure };
}

export function isSuccess(
  result: ImportJobResult
): result is Extract<ImportJobResult, { outcome: "success" }> {
  return result.outcome === "success";
}

export function isFailure(
  result: ImportJobResult
): result is Extract<ImportJobResult, { outcome: "failure" }> {
  return result.outcome === "failure";
}
