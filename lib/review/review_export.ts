/**
 * ReviewExporter
 *
 * Produces the exportable JSON payloads for a review session, split by
 * outcome: approved, rejected, or correction. This module only shapes the
 * data — writing it to disk/anywhere else is the caller's responsibility
 * (see docs/HUMAN_REVIEW.md for the intended file-based export flow; no
 * database or API is implemented here).
 */

import type { ReviewSession } from "@/lib/review/review_types";
import type { DiffEngine } from "@/lib/review/review_diff";
import { DefaultDiffEngine } from "@/lib/review/review_diff";
import type { PersonnelExtraction } from "@/lib/types/vision";

/** Payload for an approved review, ready for downstream persistence (a future phase, not this one). */
export interface ApprovedExport {
  sessionId: string;
  status: "Approved";
  extraction: PersonnelExtraction;
  approvedAt: string;
}

/** Payload for a rejected review, preserving the reason via history notes. */
export interface RejectedExport {
  sessionId: string;
  status: "Rejected";
  originalExtraction: PersonnelExtraction;
  rejectedAt: string;
  reason?: string;
}

/** Payload capturing exactly what a human corrected, for audit/training purposes. */
export interface CorrectionExport {
  sessionId: string;
  status: "NeedsCorrection";
  originalExtraction: PersonnelExtraction;
  correctedExtraction: PersonnelExtraction;
  changes: ReturnType<DiffEngine["diff"]>;
}

/** Contract for exporting a review session. Allows swapping in different export shapes later. */
export interface ReviewExporter {
  exportApproved(session: ReviewSession): ApprovedExport;
  exportRejected(session: ReviewSession, reason?: string): RejectedExport;
  exportCorrection(session: ReviewSession): CorrectionExport;
}

/**
 * Default exporter. Throws if called against a session in the wrong
 * status, since exporting e.g. "approved" data from a Pending session
 * would misrepresent the review outcome.
 */
export class DefaultReviewExporter implements ReviewExporter {
  constructor(private readonly diffEngine: DiffEngine = new DefaultDiffEngine()) {}

  exportApproved(session: ReviewSession): ApprovedExport {
    this.assertStatus(session, "Approved");

    return {
      sessionId: session.id,
      status: "Approved",
      extraction: session.editedExtraction,
      approvedAt: session.updatedAt,
    };
  }

  exportRejected(session: ReviewSession, reason?: string): RejectedExport {
    this.assertStatus(session, "Rejected");

    return {
      sessionId: session.id,
      status: "Rejected",
      originalExtraction: session.aiResult.normalized_extraction,
      rejectedAt: session.updatedAt,
      reason,
    };
  }

  exportCorrection(session: ReviewSession): CorrectionExport {
    this.assertStatus(session, "NeedsCorrection");

    return {
      sessionId: session.id,
      status: "NeedsCorrection",
      originalExtraction: session.aiResult.normalized_extraction,
      correctedExtraction: session.editedExtraction,
      changes: this.diffEngine.diff(session.aiResult.normalized_extraction, session.editedExtraction),
    };
  }

  private assertStatus(session: ReviewSession, expected: ReviewSession["status"]): void {
    if (session.status !== expected) {
      throw new Error(`Cannot export session ${session.id} as ${expected}: current status is ${session.status}`);
    }
  }
}
