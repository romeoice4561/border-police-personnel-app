/**
 * DrugPersonMatchReviewRepository (Phase DI-2 — Section 19).
 *
 * Repository-pattern access for persistent human review decisions on ONE
 * unordered pair of persons. A row's absence means "no decision yet" (the
 * matching engine's live NEEDS_REVIEW state) — this table only ever stores
 * CONFIRMED_DUPLICATE / NOT_SAME / MERGED, never a placeholder row for an
 * unresolved pair.
 */

import type { DatabaseClient, DrugPersonMatchReview } from "@/lib/database/database_types";

export type DrugPersonMatchDecisionValue = "CONFIRMED_DUPLICATE" | "NOT_SAME" | "MERGED";

export interface DrugPersonMatchReviewCreateInput {
  id: string;
  personAId: string;
  personBId: string;
  decision: DrugPersonMatchDecisionValue;
  signals: unknown;
  reviewedBy: string;
  reviewedByName: string;
  notes: string | null;
}

/** Section 19's own comment: always store the pair with the lexicographically smaller id first, so the same real-world pair is found regardless of which order a later matching pass names them in. */
export function orderPersonPair(personIdA: string, personIdB: string): [string, string] {
  return personIdA <= personIdB ? [personIdA, personIdB] : [personIdB, personIdA];
}

export class DrugPersonMatchReviewRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findForPair(personIdA: string, personIdB: string): Promise<DrugPersonMatchReview | null> {
    const [personAId, personBId] = orderPersonPair(personIdA, personIdB);
    const rows = await this.db.drugPersonMatchReview.findMany({ where: { personAId, personBId } });
    return rows[0] ?? null;
  }

  async create(input: DrugPersonMatchReviewCreateInput): Promise<DrugPersonMatchReview> {
    const [personAId, personBId] = orderPersonPair(input.personAId, input.personBId);
    return this.db.drugPersonMatchReview.create({
      data: { ...input, personAId, personBId },
    });
  }

  /** Section 19/merge: update an existing review row — used by merge to upgrade CONFIRMED_DUPLICATE → MERGED. */
  async update(id: string, data: Partial<Pick<DrugPersonMatchReviewCreateInput, "decision" | "reviewedBy" | "reviewedByName" | "notes">>): Promise<DrugPersonMatchReview> {
    return this.db.drugPersonMatchReview.update({ where: { id }, data });
  }

  /** Duplicate Review Queue (Section 13): every pair still awaiting a decision is derived live by the service layer (matching engine minus already-reviewed pairs) — this method returns only the persisted decisions, for filtering that live list. */
  findAll(): Promise<DrugPersonMatchReview[]> {
    return this.db.drugPersonMatchReview.findMany({});
  }

  findByDecision(decision: DrugPersonMatchDecisionValue): Promise<DrugPersonMatchReview[]> {
    return this.db.drugPersonMatchReview.findMany({ where: { decision } });
  }
}
