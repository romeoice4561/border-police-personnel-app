/**
 * DrugPersonMatchReviewService (Phase DI-2 — Section 19).
 *
 * Records a reviewer's persistent decision on one person pair —
 * CONFIRMED_DUPLICATE (same person, not yet merged) or NOT_SAME (matching
 * engine should stop suggesting this pair). Separate from the merge service
 * because Section 19 treats "confirmed duplicate" and "merged" as distinct
 * states — a reviewer can confirm two records are the same person while
 * deferring the heavier merge operation.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugPersonMatchReviewRepository, orderPersonPair, type DrugPersonMatchDecisionValue } from "@/lib/database/repositories/drug_person_match_review_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import { DrugPersonNotFoundError } from "@/lib/drug_intelligence/drug_case_types";

export class DrugPersonMatchReviewAlreadyDecidedError extends Error {
  constructor(personAId: string, personBId: string) {
    super(`This person pair (${personAId}, ${personBId}) already has a review decision`);
    this.name = "DrugPersonMatchReviewAlreadyDecidedError";
  }
}

export interface DrugPersonMatchReviewRequest {
  personAId: string;
  personBId: string;
  decision: Exclude<DrugPersonMatchDecisionValue, "MERGED">;
  signals: unknown;
  notes: string | null;
  actorId: string;
  actorName: string;
}

export class DrugPersonMatchReviewService {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Section 32 (concurrency): re-checks for an existing decision on this
   * exact pair right before writing, inside the transaction — if two
   * reviewers race on the same pair, the second write is rejected rather
   * than silently overwriting the first reviewer's call.
   */
  async recordDecision(request: DrugPersonMatchReviewRequest): Promise<{ reviewId: string }> {
    return this.db.$transaction(async (tx) => {
      const personRepo = new DrugPersonRepository(tx);
      const reviewRepo = new DrugPersonMatchReviewRepository(tx);
      const auditRepo = new DrugAuditLogRepository(tx);

      const [personA, personB] = await Promise.all([personRepo.findById(request.personAId), personRepo.findById(request.personBId)]);
      if (!personA) throw new DrugPersonNotFoundError(request.personAId);
      if (!personB) throw new DrugPersonNotFoundError(request.personBId);

      const [orderedA, orderedB] = orderPersonPair(request.personAId, request.personBId);
      const existing = await reviewRepo.findForPair(orderedA, orderedB);
      if (existing) throw new DrugPersonMatchReviewAlreadyDecidedError(orderedA, orderedB);

      const reviewId = generateDrugId();
      await reviewRepo.create({
        id: reviewId,
        personAId: orderedA,
        personBId: orderedB,
        decision: request.decision,
        signals: request.signals,
        reviewedBy: request.actorId,
        reviewedByName: request.actorName,
        notes: request.notes,
      });

      await auditRepo.record({
        entityType: "DrugPersonMatchReview",
        entityId: reviewId,
        action: request.decision === "CONFIRMED_DUPLICATE" ? "duplicate_reviewed" : "duplicate_marked_not_same",
        actorId: request.actorId,
        actorName: request.actorName,
        detail: `pair=${orderedA},${orderedB} decision=${request.decision}`,
      });

      return { reviewId };
    });
  }
}
