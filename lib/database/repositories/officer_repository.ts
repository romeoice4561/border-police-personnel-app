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
  /** Phase 17B: Google Drive photo identity (nullable). */
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  /**
   * Phase 20C: optional Organization master-data links (helper references
   * only — `region`/`currentUnit`/Timeline.unit text remain authoritative).
   * Omitted entirely by existing callers, so existing import behavior is
   * unchanged; only a caller that explicitly resolves via OrganizationService
   * passes these.
   */
  regionId?: number | null;
  battalionId?: number | null;
  companyId?: number | null;
  /** Phase 23A: additional contact channels (optional — omitted by import callers). */
  email?: string | null;
  lineId?: string | null;
  facebookUrl?: string | null;
}

/**
 * Phase 23A: the fields the Officer Profile Workspace lets a user edit
 * directly (as opposed to `OfficerInput`, which is the import pipeline's
 * full upsert payload). Every field is optional; only supplied keys are
 * written — mirrors the Gallery Metadata Editor's `AssetMetadataPatch`
 * "supplied fields update, absent fields untouched" convention.
 */
export interface OfficerProfilePatch {
  rank?: string;
  firstName?: string;
  lastName?: string;
  currentPosition?: string | null;
  currentUnit?: string | null;
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  facebookUrl?: string | null;
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
        // Phase 17B: persist the Drive photo identity on update too, so
        // re-importing a Drive-sourced record backfills photos on existing rows.
        driveFileId: input.driveFileId,
        thumbnailUrl: input.thumbnailUrl,
        webViewUrl: input.webViewUrl,
        // Phase 20C: only touch the organization links when the caller
        // explicitly resolved them — omitted keys leave the existing row's
        // links (or NULL) untouched, so a caller that never resolves
        // organization data (the existing importer) affects nothing here.
        ...(input.regionId !== undefined ? { regionId: input.regionId } : {}),
        ...(input.battalionId !== undefined ? { battalionId: input.battalionId } : {}),
        ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
        // Phase 23A: same omit-if-undefined convention for contact fields.
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.lineId !== undefined ? { lineId: input.lineId } : {}),
        ...(input.facebookUrl !== undefined ? { facebookUrl: input.facebookUrl } : {}),
      },
    });

    return { officer, created: existing === null };
  }

  count(): Promise<number> {
    return this.db.officer.count();
  }

  /**
   * Phase 23A: updates only the supplied profile fields for an existing
   * officer (user-driven edit, not an import upsert — never creates a row).
   * Returns null when the officer doesn't exist. Mirrors
   * PrismaAssetRepository.updateMetadata's "only touch present keys" pattern.
   */
  async updateProfile(officerId: string, patch: OfficerProfilePatch): Promise<Officer | null> {
    const existing = await this.db.officer.findUnique({ where: { officerId } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if ("rank" in patch) data.rank = patch.rank;
    if ("firstName" in patch) data.firstName = patch.firstName;
    if ("lastName" in patch) data.lastName = patch.lastName;
    if ("currentPosition" in patch) data.currentPosition = patch.currentPosition;
    if ("currentUnit" in patch) data.currentUnit = patch.currentUnit;
    if ("phone" in patch) data.phone = patch.phone;
    if ("email" in patch) data.email = patch.email;
    if ("lineId" in patch) data.lineId = patch.lineId;
    if ("facebookUrl" in patch) data.facebookUrl = patch.facebookUrl;

    if (Object.keys(data).length === 0) return existing;

    return this.db.officer.update({ where: { officerId }, data });
  }
}
