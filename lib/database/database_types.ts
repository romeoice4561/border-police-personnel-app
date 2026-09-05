/**
 * Database contracts (Phase 12).
 *
 * Narrow, hand-written interfaces over the subset of Prisma's generated API
 * that the repositories and importer use. Depending on these (rather than the
 * concrete PrismaClient) keeps the repository layer decoupled from Prisma's
 * huge generated types and — crucially — lets tests inject a lightweight
 * in-memory fake client with NO live database, matching this codebase's
 * fake-based testing convention throughout.
 *
 * Only the operations actually used are declared. `Prisma.*` model types are
 * imported from the generated client for the row shapes, but no Prisma runtime
 * behavior is assumed beyond these method signatures.
 */

// Phase 16B: model types come from the Prisma 7 generated client (source
// tree), re-exported under their plain names (Officer, Timeline, …) — types
// are identical to the former @prisma/client imports.
import type { Officer, Timeline, Unit, Phone, ImportJob, ImportLog, Education, Training, SalaryHistory, OfficerDocument, SkillCategory, Skill, SkillLevel, OfficerSkill } from "@/lib/generated/prisma/client";
// Phase DI-1: Drug Intelligence models, same generated-client re-export convention.
import type {
  DrugCase,
  DrugPerson,
  DrugPersonIdentifier,
  DrugPersonAlias,
  DrugCasePerson,
  DrugPhoneNumber,
  DrugCasePhone,
  DrugSim,
  DrugCaseSim,
  DrugDevice,
  DrugPersonDevice,
  DrugCaseDevice,
  DrugVehicle,
  DrugPersonVehicle,
  DrugCaseVehicle,
  DrugLocation,
  DrugCaseLocation,
  DrugSeizedItem,
  DrugAuditLog,
  DrugPersonMatchReview,
  DrugPersonMerge,
  DrugIntelligenceAlert,
  // DI-7.2/7.3: new intelligence tables
  DrugNetworkGroup,
  DrugPersonNetworkMembership,
  DrugPersonNetworkRole,
  // DI-7.6: arrest team / participating units
  DrugCaseParticipatingUnit,
  DrugCaseOfficer,
  DrugInvestigationBoard,
  DrugInvestigationBoardImage,
} from "@/lib/generated/prisma/client";

export type { Officer, Timeline, Unit, Phone, ImportJob, ImportLog, Education, Training, SalaryHistory, OfficerDocument, SkillCategory, Skill, SkillLevel, OfficerSkill };
export type {
  DrugCase,
  DrugPerson,
  DrugPersonIdentifier,
  DrugPersonAlias,
  DrugCasePerson,
  DrugPhoneNumber,
  DrugCasePhone,
  DrugSim,
  DrugCaseSim,
  DrugDevice,
  DrugPersonDevice,
  DrugCaseDevice,
  DrugVehicle,
  DrugPersonVehicle,
  DrugCaseVehicle,
  DrugLocation,
  DrugCaseLocation,
  DrugSeizedItem,
  DrugAuditLog,
  DrugPersonMatchReview,
  DrugPersonMerge,
  DrugIntelligenceAlert,
  DrugNetworkGroup,
  DrugPersonNetworkMembership,
  DrugPersonNetworkRole,
  DrugCaseParticipatingUnit,
  DrugCaseOfficer,
  DrugInvestigationBoard,
  DrugInvestigationBoardImage,
};

/** Generic Prisma-style delegate for a model, limited to the calls we make. */
export interface ModelDelegate<TRow, TCreate, TUpdate, TWhereUnique> {
  findUnique(args: { where: TWhereUnique }): Promise<TRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
    /** DI-9.4.3B: Prisma-native pagination (skip/take). Optional for backward compatibility. */
    skip?: number;
    take?: number;
    /** DI-9.4.3B: optional column projection. Fakes may ignore. */
    select?: Record<string, boolean>;
  }): Promise<TRow[]>;
  create(args: { data: TCreate }): Promise<TRow>;
  update(args: { where: TWhereUnique; data: TUpdate }): Promise<TRow>;
  upsert(args: { where: TWhereUnique; create: TCreate; update: TUpdate }): Promise<TRow>;
  deleteMany(args?: { where?: Record<string, unknown> }): Promise<{ count: number }>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
}

/** The delegates the repositories operate through. Structurally satisfied by PrismaClient and by test fakes. */
export interface DatabaseClient {
  officer: ModelDelegate<Officer, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  timeline: ModelDelegate<Timeline, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  unit: ModelDelegate<Unit, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  phone: ModelDelegate<Phone, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  importJob: ModelDelegate<ImportJob, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  importLog: ModelDelegate<ImportLog, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 23A: Officer Profile Workspace — Education/Training CRUD rows. */
  education: ModelDelegate<Education, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  training: ModelDelegate<Training, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 28A: Career Intelligence Foundation — one salary-step result per officer per Buddhist-Era year. */
  salaryHistory: ModelDelegate<SalaryHistory, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 29A: Officer Document Vault — generic document rows (one per upload, versioned). */
  officerDocument: ModelDelegate<OfficerDocument, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 44: Personnel Capability Intelligence — skills master tables + per-officer skills (replace-all on save). */
  skillCategory: ModelDelegate<SkillCategory, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  skill: ModelDelegate<Skill, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  skillLevel: ModelDelegate<SkillLevel, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  officerSkill: ModelDelegate<OfficerSkill, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-1: Drug Intelligence — case/entity/relationship tables. Same narrow ModelDelegate convention as every table above. */
  drugCase: ModelDelegate<DrugCase, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPerson: ModelDelegate<DrugPerson, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonIdentifier: ModelDelegate<DrugPersonIdentifier, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonAlias: ModelDelegate<DrugPersonAlias, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCasePerson: ModelDelegate<DrugCasePerson, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPhoneNumber: ModelDelegate<DrugPhoneNumber, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCasePhone: ModelDelegate<DrugCasePhone, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugSim: ModelDelegate<DrugSim, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCaseSim: ModelDelegate<DrugCaseSim, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugDevice: ModelDelegate<DrugDevice, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonDevice: ModelDelegate<DrugPersonDevice, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCaseDevice: ModelDelegate<DrugCaseDevice, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugVehicle: ModelDelegate<DrugVehicle, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonVehicle: ModelDelegate<DrugPersonVehicle, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCaseVehicle: ModelDelegate<DrugCaseVehicle, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugLocation: ModelDelegate<DrugLocation, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCaseLocation: ModelDelegate<DrugCaseLocation, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugSeizedItem: ModelDelegate<DrugSeizedItem, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugAuditLog: ModelDelegate<DrugAuditLog, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-2: Entity Resolution — persistent match-review decisions and merge history. Same narrow ModelDelegate convention. */
  drugPersonMatchReview: ModelDelegate<DrugPersonMatchReview, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonMerge: ModelDelegate<DrugPersonMerge, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-6: Repeat Entity Detection & Intelligence Alerts — persisted alert events. Same narrow ModelDelegate convention. */
  drugIntelligenceAlert: ModelDelegate<DrugIntelligenceAlert, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-7.2/7.3: Network groups, memberships, and network-role assertions. */
  drugNetworkGroup: ModelDelegate<DrugNetworkGroup, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonNetworkMembership: ModelDelegate<DrugPersonNetworkMembership, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugPersonNetworkRole: ModelDelegate<DrugPersonNetworkRole, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-7.6: arrest-team / participating-unit data foundation. Same narrow ModelDelegate convention. */
  drugCaseParticipatingUnit: ModelDelegate<DrugCaseParticipatingUnit, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  drugCaseOfficer: ModelDelegate<DrugCaseOfficer, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-9.5B: Saved Investigation Boards — analyst workspace overlay. */
  drugInvestigationBoard: ModelDelegate<DrugInvestigationBoard, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase DI-9.5D: private investigation-board image metadata. */
  drugInvestigationBoardImage: ModelDelegate<DrugInvestigationBoardImage, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /**
   * Runs `fn` inside a single database transaction, passing a transaction-scoped
   * client with the same delegate surface. Mirrors PrismaClient.$transaction's
   * interactive form. A thrown error rolls the whole transaction back.
   *
   * `options` mirrors Prisma's interactive-transaction options (`maxWait` /
   * `timeout`). Fakes may ignore them.
   */
  $transaction<T>(
    fn: (tx: DatabaseClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T>;
}

/** The action recorded for each officer during an import (for ImportLog + statistics). */
export type ImportAction = "created" | "updated" | "skipped" | "error";
