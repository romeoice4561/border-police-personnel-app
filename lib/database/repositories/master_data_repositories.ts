/**
 * Master Data repositories (Phase 24A — Database V2 Foundation).
 *
 * Repository-pattern access for the V2 master tables over an injected
 * MasterDataClient (no globals, no singleton) — the same architecture as the
 * existing Phase 12/13 repositories. Each repository is keyed on the table's
 * unique `code`, making seeding idempotent: re-running a seed upserts by code
 * and never creates a duplicate row.
 *
 * Pure data access only — no business logic. Query logic is not duplicated:
 * the shared `CodeKeyedRepository` base implements find/list/count/upsert once,
 * and each concrete repository only supplies its delegate + input mapping.
 *
 * Listing excludes soft-deleted rows (`is_deleted = false`) and orders by
 * `display_order` then `code`, per the V2 soft-delete + display-order design.
 */

import type {
  MasterDataClient,
  MasterModelDelegate,
  MasterRegion,
  MasterCommand,
  MasterSubdivision,
  MasterCompany,
  MasterRank,
  MasterPosition,
  MasterTimelineType,
  MasterAssetType,
  MasterDocumentType,
} from "@/lib/database/master_data_types";

/**
 * Shared base for a master table keyed on a unique `code`. `TInput` is the
 * caller-facing create/update payload (never includes id/audit/soft-delete
 * columns — those are DB-managed). Concrete repositories map `TInput` to the
 * Prisma create/update data shape.
 */
abstract class CodeKeyedRepository<TRow extends { code: string }, TInput> {
  protected abstract readonly delegate: MasterModelDelegate<TRow>;

  /** Maps caller input to the Prisma write payload (identical on create/update). */
  protected abstract toData(input: TInput): Record<string, unknown>;

  findByCode(code: string): Promise<TRow | null> {
    return this.delegate.findUnique({ where: { code } });
  }

  /** Active (non-soft-deleted) rows, ordered by display_order then code. */
  listActive(): Promise<TRow[]> {
    return this.delegate.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    });
  }

  count(): Promise<number> {
    return this.delegate.count();
  }

  /**
   * Idempotent upsert keyed on `code`. Returns the row plus whether it was
   * newly created — so a seed run can report created vs. updated without a
   * second query. Audit/soft-delete/id columns are DB-managed and never sent.
   */
  async upsertByCode(input: TInput): Promise<{ row: TRow; created: boolean }> {
    const data = this.toData(input);
    const code = data.code as string;
    const existing = await this.delegate.findUnique({ where: { code } });
    const row = await this.delegate.upsert({
      where: { code },
      create: data,
      update: data,
    });
    return { row, created: existing === null };
  }
}

// ── Region ───────────────────────────────────────────────────────────────────
export interface MasterRegionInput {
  code: string;
  nameTh: string;
  nameEn?: string | null;
  displayOrder?: number;
}

export class MasterRegionRepository extends CodeKeyedRepository<MasterRegion, MasterRegionInput> {
  protected readonly delegate: MasterModelDelegate<MasterRegion>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterRegion;
  }
  protected toData(input: MasterRegionInput): Record<string, unknown> {
    return {
      code: input.code,
      nameTh: input.nameTh,
      nameEn: input.nameEn ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Command ──────────────────────────────────────────────────────────────────
export interface MasterCommandInput {
  code: string;
  regionId: string;
  name: string;
  displayOrder?: number;
}

export class MasterCommandRepository extends CodeKeyedRepository<MasterCommand, MasterCommandInput> {
  protected readonly delegate: MasterModelDelegate<MasterCommand>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterCommand;
  }
  protected toData(input: MasterCommandInput): Record<string, unknown> {
    return {
      code: input.code,
      regionId: input.regionId,
      name: input.name,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Subdivision ──────────────────────────────────────────────────────────────
export interface MasterSubdivisionInput {
  code: string;
  commandId: string;
  shortName: string;
  fullName: string;
  province?: string | null;
  displayOrder?: number;
}

export class MasterSubdivisionRepository extends CodeKeyedRepository<MasterSubdivision, MasterSubdivisionInput> {
  protected readonly delegate: MasterModelDelegate<MasterSubdivision>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterSubdivision;
  }
  protected toData(input: MasterSubdivisionInput): Record<string, unknown> {
    return {
      code: input.code,
      commandId: input.commandId,
      shortName: input.shortName,
      fullName: input.fullName,
      province: input.province ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Company ──────────────────────────────────────────────────────────────────
export interface MasterCompanyInput {
  code: string;
  subdivisionId: string;
  companyNo?: string | null;
  shortName: string;
  fullName: string;
  location?: string | null;
  province?: string | null;
  displayOrder?: number;
}

export class MasterCompanyRepository extends CodeKeyedRepository<MasterCompany, MasterCompanyInput> {
  protected readonly delegate: MasterModelDelegate<MasterCompany>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterCompany;
  }
  protected toData(input: MasterCompanyInput): Record<string, unknown> {
    return {
      code: input.code,
      subdivisionId: input.subdivisionId,
      companyNo: input.companyNo ?? null,
      shortName: input.shortName,
      fullName: input.fullName,
      location: input.location ?? null,
      province: input.province ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Rank ─────────────────────────────────────────────────────────────────────
export interface MasterRankInput {
  code: string;
  nameTh: string;
  abbreviation?: string | null;
  level: number;
  groupName?: string | null;
  displayOrder?: number;
}

export class MasterRankRepository extends CodeKeyedRepository<MasterRank, MasterRankInput> {
  protected readonly delegate: MasterModelDelegate<MasterRank>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterRank;
  }
  protected toData(input: MasterRankInput): Record<string, unknown> {
    return {
      code: input.code,
      nameTh: input.nameTh,
      abbreviation: input.abbreviation ?? null,
      level: input.level,
      groupName: input.groupName ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Position ─────────────────────────────────────────────────────────────────
export interface MasterPositionInput {
  code: string;
  nameTh: string;
  positionGroup?: string | null;
  displayOrder?: number;
}

export class MasterPositionRepository extends CodeKeyedRepository<MasterPosition, MasterPositionInput> {
  protected readonly delegate: MasterModelDelegate<MasterPosition>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterPosition;
  }
  protected toData(input: MasterPositionInput): Record<string, unknown> {
    return {
      code: input.code,
      nameTh: input.nameTh,
      positionGroup: input.positionGroup ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Timeline Type ────────────────────────────────────────────────────────────
export interface MasterTimelineTypeInput {
  code: string;
  nameTh: string;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
  displayOrder?: number;
}

export class MasterTimelineTypeRepository extends CodeKeyedRepository<MasterTimelineType, MasterTimelineTypeInput> {
  protected readonly delegate: MasterModelDelegate<MasterTimelineType>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterTimelineType;
  }
  protected toData(input: MasterTimelineTypeInput): Record<string, unknown> {
    return {
      code: input.code,
      nameTh: input.nameTh,
      nameEn: input.nameEn ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Asset Type ───────────────────────────────────────────────────────────────
export interface MasterAssetTypeInput {
  code: string;
  nameTh: string;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
  displayOrder?: number;
}

export class MasterAssetTypeRepository extends CodeKeyedRepository<MasterAssetType, MasterAssetTypeInput> {
  protected readonly delegate: MasterModelDelegate<MasterAssetType>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterAssetType;
  }
  protected toData(input: MasterAssetTypeInput): Record<string, unknown> {
    return {
      code: input.code,
      nameTh: input.nameTh,
      nameEn: input.nameEn ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

// ── Document Type ────────────────────────────────────────────────────────────
export interface MasterDocumentTypeInput {
  code: string;
  nameTh: string;
  nameEn?: string | null;
  displayOrder?: number;
}

export class MasterDocumentTypeRepository extends CodeKeyedRepository<MasterDocumentType, MasterDocumentTypeInput> {
  protected readonly delegate: MasterModelDelegate<MasterDocumentType>;
  constructor(db: MasterDataClient) {
    super();
    this.delegate = db.masterDocumentType;
  }
  protected toData(input: MasterDocumentTypeInput): Record<string, unknown> {
    return {
      code: input.code,
      nameTh: input.nameTh,
      nameEn: input.nameEn ?? null,
      displayOrder: input.displayOrder ?? 0,
    };
  }
}

/** Convenience bundle: all master-data repositories over one client. */
export function createMasterDataRepositories(db: MasterDataClient) {
  return {
    regions: new MasterRegionRepository(db),
    commands: new MasterCommandRepository(db),
    subdivisions: new MasterSubdivisionRepository(db),
    companies: new MasterCompanyRepository(db),
    ranks: new MasterRankRepository(db),
    positions: new MasterPositionRepository(db),
    timelineTypes: new MasterTimelineTypeRepository(db),
    assetTypes: new MasterAssetTypeRepository(db),
    documentTypes: new MasterDocumentTypeRepository(db),
  };
}
