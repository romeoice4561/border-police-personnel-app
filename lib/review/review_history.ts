/**
 * ReviewHistoryTracker
 *
 * Appends and reads audit history entries (reviewer, timestamp, action,
 * changes) for a review session. Kept separate from ReviewSession storage
 * so history can be queried/exported independently.
 */

import type { DiffResult, ReviewHistoryEntry, ReviewStatus, Reviewer } from "@/lib/review/review_types";

/** Contract for history tracking. Allows swapping in a persisted history store later. */
export interface ReviewHistoryTracker {
  record(
    history: ReviewHistoryEntry[],
    reviewer: Reviewer,
    action: ReviewStatus | "Edited" | "Created",
    changes?: DiffResult,
    note?: string
  ): ReviewHistoryEntry[];
}

/**
 * Default in-memory history tracker: returns a new array with the entry
 * appended (immutable, matching the rest of the review layer's style).
 *
 * Future extension point: persist history entries to a store so they
 * survive process restarts, behind the same `ReviewHistoryTracker`
 * interface.
 */
export class DefaultReviewHistoryTracker implements ReviewHistoryTracker {
  record(
    history: ReviewHistoryEntry[],
    reviewer: Reviewer,
    action: ReviewStatus | "Edited" | "Created",
    changes?: DiffResult,
    note?: string
  ): ReviewHistoryEntry[] {
    const entry: ReviewHistoryEntry = {
      timestamp: new Date().toISOString(),
      reviewer,
      action,
      changes,
      note,
    };

    return [...history, entry];
  }
}
