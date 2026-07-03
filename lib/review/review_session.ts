/**
 * ReviewSessionManager
 *
 * Owns the lifecycle of a single ReviewSession: creation from an
 * AIExtractionResult, applying human edits, and transitioning status
 * (Pending -> Approved/Rejected/NeedsCorrection). Composes DiffEngine,
 * ConfidenceReviewEngine, and ReviewHistoryTracker via dependency
 * injection rather than owning that logic itself (single responsibility).
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type {
  AIExtractionResult,
  ReviewSession,
  ReviewStatus,
  Reviewer,
} from "@/lib/review/review_types";
import type { DiffEngine } from "@/lib/review/review_diff";
import { DefaultDiffEngine } from "@/lib/review/review_diff";
import type { ConfidenceReviewEngine } from "@/lib/review/review_confidence";
import { DefaultConfidenceReviewEngine } from "@/lib/review/review_confidence";
import type { ReviewHistoryTracker } from "@/lib/review/review_history";
import { DefaultReviewHistoryTracker } from "@/lib/review/review_history";
import { canTransitionReviewStatus } from "@/lib/review/review_status";

export interface ReviewSessionManagerDependencies {
  diffEngine?: DiffEngine;
  confidenceEngine?: ConfidenceReviewEngine;
  historyTracker?: ReviewHistoryTracker;
  idGenerator?: () => string;
}

/**
 * Creates and mutates ReviewSession objects. All mutation methods return a
 * new ReviewSession (immutable style, consistent with lib/import's
 * transitionJob pattern) rather than mutating in place.
 */
export class ReviewSessionManager {
  private readonly diffEngine: DiffEngine;
  private readonly confidenceEngine: ConfidenceReviewEngine;
  private readonly historyTracker: ReviewHistoryTracker;
  private readonly idGenerator: () => string;

  constructor(dependencies: ReviewSessionManagerDependencies = {}) {
    this.diffEngine = dependencies.diffEngine ?? new DefaultDiffEngine();
    this.confidenceEngine = dependencies.confidenceEngine ?? new DefaultConfidenceReviewEngine();
    this.historyTracker = dependencies.historyTracker ?? new DefaultReviewHistoryTracker();
    this.idGenerator = dependencies.idGenerator ?? (() => `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }

  /** Creates a new Pending review session from an AI extraction result. */
  createSession(aiResult: AIExtractionResult, createdBy: Reviewer): ReviewSession {
    const now = new Date().toISOString();
    const concerns = this.confidenceEngine.analyze(aiResult.normalized_extraction);

    const session: ReviewSession = {
      id: this.idGenerator(),
      aiResult,
      editedExtraction: { ...aiResult.normalized_extraction },
      status: "Pending",
      concerns,
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    return {
      ...session,
      history: this.historyTracker.record(session.history, createdBy, "Created"),
    };
  }

  /** Applies a human-edited extraction to the session, recording a diff-tracked history entry. */
  applyEdit(session: ReviewSession, edited: PersonnelExtraction, reviewer: Reviewer, note?: string): ReviewSession {
    const diff = this.diffEngine.diff(session.editedExtraction, edited);

    return {
      ...session,
      editedExtraction: edited,
      updatedAt: new Date().toISOString(),
      history: this.historyTracker.record(session.history, reviewer, "Edited", diff, note),
    };
  }

  /** Transitions the session's status, validating the transition and recording history. */
  transitionStatus(session: ReviewSession, to: ReviewStatus, reviewer: Reviewer, note?: string): ReviewSession {
    if (!canTransitionReviewStatus(session.status, to)) {
      throw new Error(`Illegal review status transition: ${session.status} -> ${to} (session ${session.id})`);
    }

    return {
      ...session,
      status: to,
      updatedAt: new Date().toISOString(),
      history: this.historyTracker.record(session.history, reviewer, to, undefined, note),
    };
  }

  /** Computes the diff between the original AI extraction and the current edited state. */
  computeDiff(session: ReviewSession) {
    return this.diffEngine.diff(session.aiResult.normalized_extraction, session.editedExtraction);
  }
}
