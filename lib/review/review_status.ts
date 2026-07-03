/**
 * Review status transition rules.
 *
 * Kept separate from ReviewSession's storage (review_session.ts) so the
 * state machine is auditable in one place, mirroring the pattern used for
 * ImportJob status in lib/import/import_job.ts.
 */

import type { ReviewStatus } from "@/lib/review/review_types";

const ALLOWED_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  Pending: ["Approved", "Rejected", "NeedsCorrection"],
  NeedsCorrection: ["Pending", "Approved", "Rejected"],
  Approved: [],
  Rejected: [],
};

/** Returns whether transitioning from `from` to `to` is a legal review status change. */
export function canTransitionReviewStatus(from: ReviewStatus, to: ReviewStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Whether a status is terminal (no further transitions expected). */
export function isTerminalReviewStatus(status: ReviewStatus): boolean {
  return status === "Approved" || status === "Rejected";
}
