/**
 * ImportJob helpers.
 *
 * Factory and pure state-transition functions for ImportJob. Keeping
 * transitions here (rather than scattered across queue/worker) keeps the
 * state machine in one place and easy to audit against
 * docs/IMPORT_STATE_MACHINE.md.
 */

import type { ImportJob, ImportJobPriority, ImportJobStatus, ScannedImage } from "@/types/import";

/** Valid forward transitions. Used to guard against illegal status changes. */
const ALLOWED_TRANSITIONS: Record<ImportJobStatus, ImportJobStatus[]> = {
  Pending: ["Queued", "Cancelled"],
  Queued: ["Processing", "Cancelled"],
  Processing: ["Vision", "Failed", "Cancelled"],
  Vision: ["Parsing", "Failed", "Cancelled"],
  Parsing: ["Validating", "Failed", "Cancelled"],
  Validating: ["Completed", "Failed", "Cancelled"],
  Completed: [],
  Failed: ["Retrying", "Cancelled"],
  Retrying: ["Queued", "Cancelled"],
  Cancelled: [],
};

/**
 * Creates a new ImportJob in the `Pending` state from a scanned image.
 *
 * Future extension point: accept region/source metadata from a real
 * Google Drive scanner once that integration exists.
 */
export function createImportJob(
  image: ScannedImage,
  options: { id: string; priority?: ImportJobPriority } = { id: image.hash }
): ImportJob {
  return {
    id: options.id,
    filename: image.filename,
    hash: image.hash,
    status: "Pending",
    priority: options.priority ?? "normal",
    created_at: new Date().toISOString(),
    retry_count: 0,
  };
}

/** Returns whether transitioning from `from` to `to` is legal per the state machine. */
export function canTransition(from: ImportJobStatus, to: ImportJobStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Applies a status transition to a job, returning a new ImportJob object.
 * Throws if the transition is not allowed, to catch pipeline bugs early.
 */
export function transitionJob(job: ImportJob, to: ImportJobStatus): ImportJob {
  if (!canTransition(job.status, to)) {
    throw new Error(`Illegal ImportJob transition: ${job.status} -> ${to} (job ${job.id})`);
  }

  const next: ImportJob = { ...job, status: to };

  if (to === "Processing" && !next.started_at) {
    next.started_at = new Date().toISOString();
  }

  if (to === "Completed" || to === "Failed" || to === "Cancelled") {
    next.finished_at = new Date().toISOString();
  }

  if (to === "Retrying") {
    next.retry_count += 1;
  }

  return next;
}
