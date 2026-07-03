/**
 * OfficerRepository (Phase 12).
 *
 * Repository-pattern data access for Officer rows over an injected
 * DatabaseClient (no globals, no singleton). Upsert is keyed on the unique
 * `officerId`, making officer persistence idempotent: re-importing the same
 * export updates the existing row rather than creating a duplicate.
 *
 * Pure data access only — no business logic, no OpenAI/OCR/Drive. The values
 * it writes are computed by the importer from the pipeline's own JSON.
 */

import type { DatabaseClient, Officer } from "@/lib/database/database_types";

/** The persisted officer fields, as computed by the importer from exported JSON. */
export interface OfficerInput {
  officerId: string;
  rank: string;
  firstName: string;
  lastName: string;
  currentPosition: string | null;
  currentUnit: string | null;
  phone: string | null;
  careerYears: number;
  qualityScore: number | null;
  knowledgeScore: number | null;
  region: string | null;
  confidence: number | null;
}

export class OfficerRepository {
  constructor(private readonly db: DatabaseClient) {}

  findByOfficerId(officerId: string): Promise<Officer | null> {
    return this.db.officer.findUnique({ where: { officerId } });
  }

  /**
   * Idempotent upsert keyed on officerId. Returns the row plus whether it was
   * newly created (create) or matched an existing row (update), so the
   * importer can tally created vs. updated without a second query.
   */
  async upsert(input: OfficerInput): Promise<{ officer: Officer; created: boolean }> {
    const existing = await this.db.officer.findUnique({ where: { officerId: input.officerId } });

    const officer = await this.db.officer.upsert({
      where: { officerId: input.officerId },
      create: { ...input },
      update: {
        rank: input.rank,
        firstName: input.firstName,
        lastName: input.lastName,
        currentPosition: input.currentPosition,
        currentUnit: input.currentUnit,
        phone: input.phone,
        careerYears: input.careerYears,
        qualityScore: input.qualityScore,
        knowledgeScore: input.knowledgeScore,
        region: input.region,
        confidence: input.confidence,
      },
    });

    return { officer, created: existing === null };
  }

  count(): Promise<number> {
    return this.db.officer.count();
  }
}
