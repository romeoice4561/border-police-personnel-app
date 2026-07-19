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
  /** Phase 26B Part 5 Part C/I: structured Current Organization hierarchy, replacing the free-text Unit field in the editor (Timeline.unit and this officer's currentUnit legacy text are left untouched — see the workspace hook's derivation). */
  headquartersId?: number | null;
  regionId?: number | null;
  battalionId?: number | null;
  companyId?: number | null;
  /** Phase 26B Part 5 Part C: nickname now lives alongside Phone/Email/LINE/Facebook in the same Current Organization section, not a separate card. */
  nickname?: string | null;
  /** Phase 26B Part 5 Part G: Personal Information. */
  dateOfBirth?: Date | null;
  bloodGroup?: string | null;
  rh?: string | null;
  maritalStatus?: string | null;
  children?: number | null;
  homeProvince?: string | null;
  shirtSize?: string | null;
  nationality?: string | null;
  /** Phase 26B Part 5 Part O: optional additional fields. */
  citizenId?: string | null;
  passportNumber?: string | null;
  employeeNumber?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  addressSummary?: string | null;
  currentProvince?: string | null;
  religion?: string | null;
  educationLevel?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  uniformShoeSize?: string | null;
  hatSize?: string | null;
  jacketSize?: string | null;
  /**
   * Phase 45.1: Personnel Master Data Expansion — membership + salary/bank
   * fields. Factual Master Data only; no Intelligence calculation reads or
   * writes these. Membership fields are tri-state (true/false/null) — null
   * means "unknown", never coerced to false.
   */
  academyClass?: number | null;
  isGpfMember?: boolean | null;
  isPoliceFuneralWelfareMember?: boolean | null;
  isCooperativeMember?: boolean | null;
  cooperativeName?: string | null;
  salaryLevel?: string | null;
  currentSalaryStep?: string | null;
  currentSalary?: number | null;
  otherSpecialAllowances?: number | null;
  cooperativeMonthlyDeduction?: number | null;
  netSalary?: number | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
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
    if ("headquartersId" in patch) data.headquartersId = patch.headquartersId;
    if ("regionId" in patch) data.regionId = patch.regionId;
    if ("battalionId" in patch) data.battalionId = patch.battalionId;
    if ("companyId" in patch) data.companyId = patch.companyId;
    if ("nickname" in patch) data.nickname = patch.nickname;
    if ("dateOfBirth" in patch) data.dateOfBirth = patch.dateOfBirth;
    if ("bloodGroup" in patch) data.bloodGroup = patch.bloodGroup;
    if ("rh" in patch) data.rh = patch.rh;
    if ("maritalStatus" in patch) data.maritalStatus = patch.maritalStatus;
    if ("children" in patch) data.children = patch.children;
    if ("homeProvince" in patch) data.homeProvince = patch.homeProvince;
    if ("shirtSize" in patch) data.shirtSize = patch.shirtSize;
    if ("nationality" in patch) data.nationality = patch.nationality;
    if ("citizenId" in patch) data.citizenId = patch.citizenId;
    if ("passportNumber" in patch) data.passportNumber = patch.passportNumber;
    if ("employeeNumber" in patch) data.employeeNumber = patch.employeeNumber;
    if ("emergencyContact" in patch) data.emergencyContact = patch.emergencyContact;
    if ("emergencyPhone" in patch) data.emergencyPhone = patch.emergencyPhone;
    if ("addressSummary" in patch) data.addressSummary = patch.addressSummary;
    if ("currentProvince" in patch) data.currentProvince = patch.currentProvince;
    if ("religion" in patch) data.religion = patch.religion;
    if ("educationLevel" in patch) data.educationLevel = patch.educationLevel;
    if ("weightKg" in patch) data.weightKg = patch.weightKg;
    if ("heightCm" in patch) data.heightCm = patch.heightCm;
    if ("uniformShoeSize" in patch) data.uniformShoeSize = patch.uniformShoeSize;
    if ("hatSize" in patch) data.hatSize = patch.hatSize;
    if ("jacketSize" in patch) data.jacketSize = patch.jacketSize;
    if ("academyClass" in patch) data.academyClass = patch.academyClass;
    if ("isGpfMember" in patch) data.isGpfMember = patch.isGpfMember;
    if ("isPoliceFuneralWelfareMember" in patch) data.isPoliceFuneralWelfareMember = patch.isPoliceFuneralWelfareMember;
    if ("isCooperativeMember" in patch) data.isCooperativeMember = patch.isCooperativeMember;
    if ("cooperativeName" in patch) data.cooperativeName = patch.cooperativeName;
    if ("salaryLevel" in patch) data.salaryLevel = patch.salaryLevel;
    if ("currentSalaryStep" in patch) data.currentSalaryStep = patch.currentSalaryStep;
    if ("currentSalary" in patch) data.currentSalary = patch.currentSalary;
    if ("otherSpecialAllowances" in patch) data.otherSpecialAllowances = patch.otherSpecialAllowances;
    if ("cooperativeMonthlyDeduction" in patch) data.cooperativeMonthlyDeduction = patch.cooperativeMonthlyDeduction;
    if ("netSalary" in patch) data.netSalary = patch.netSalary;
    if ("bankName" in patch) data.bankName = patch.bankName;
    if ("bankAccountNumber" in patch) data.bankAccountNumber = patch.bankAccountNumber;

    if (Object.keys(data).length === 0) return existing;

    return this.db.officer.update({ where: { officerId }, data });
  }

  /**
   * Phase 26A: pins `profilePhotoId` as the officer's OFFICIAL portrait
   * (Officer.officialPortraitId) — displayed everywhere in preference to any
   * automatic resolver tier. Pass `null` to unpin (falls back to the
   * automatic tiers). Never touches the ProfilePhoto row itself — the
   * original Drive card / prior uploads are never overwritten or deleted by
   * this call, only the officer's DISPLAY pointer changes. Returns null when
   * the officer doesn't exist.
   */
  async setOfficialPortrait(officerId: string, profilePhotoId: number | null): Promise<Officer | null> {
    const existing = await this.db.officer.findUnique({ where: { officerId } });
    if (!existing) return null;

    return this.db.officer.update({ where: { officerId }, data: { officialPortraitId: profilePhotoId } });
  }
}
