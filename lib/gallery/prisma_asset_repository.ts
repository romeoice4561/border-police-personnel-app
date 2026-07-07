/**
 * PrismaAssetRepository (Phase 19B — Gallery Persistence).
 *
 * The production AssetRepository, backed by the Asset table in Supabase/
 * PostgreSQL. It implements the same Phase 19A AssetRepository interface as the
 * in-memory reference impl, so it is a drop-in replacement under dependency
 * injection (the in-memory impl is kept for tests). Idempotent: upsert is keyed
 * on the unique `assetId`, so re-ingesting the same discovery creates no
 * duplicates.
 *
 * It depends on a narrow, hand-written `AssetDbClient` delegate (mirroring the
 * officer query layer's ReadDatabaseClient pattern) rather than the concrete
 * PrismaClient — so it is decoupled from Prisma's generated types and testable
 * with an in-memory fake. No OCR, no AI, no officer tables, no globals.
 */

import type {
  Asset,
  AssetCategoryCount,
  AssetFacetCount,
  AssetMetadataPatch,
  AssetQuery,
  PaginatedAssets,
} from "@/lib/gallery/asset_types";
import { AssetCategory, isGalleryCategory } from "@/lib/gallery/asset_category";
import type { AssetRepository } from "@/lib/gallery/asset_repository";

/** A persisted Asset row (matches the Prisma Asset model, including Phase 22A columns). */
export interface AssetRow {
  id: number;
  assetId: string;
  category: string;
  region: string | null;
  company: string | null;
  battalion: string | null;
  folderName: string | null;
  relativePath: string;
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdTime: Date | string | null;
  updatedTime: Date | string | null;
  companyId: number | null;
  // Phase 22A: editable metadata fields
  unitName:    string | null;
  unitNumber:  string | null;
  keywords:    string;   // comma-joined in DB, split to string[] in domain
  description: string | null;
  remarks:     string | null;
  verified:    boolean;
}

/** The subset of the Prisma Asset delegate this repository uses. Structurally satisfied by PrismaClient.asset and by fakes. */
export interface AssetDelegate {
  findUnique(args: { where: Record<string, unknown> }): Promise<AssetRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
    skip?: number;
    take?: number;
  }): Promise<AssetRow[]>;
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<AssetRow>;
  /** Phase 22A: targeted field update (returns the updated row). */
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<AssetRow>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
  groupBy(args: {
    by: string[];
    where?: Record<string, unknown>;
    _count?: boolean | Record<string, boolean>;
  }): Promise<Array<Record<string, unknown>>>;
}

/** The client surface the repository depends on. */
export interface AssetDbClient {
  asset: AssetDelegate;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function toIso(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses the comma-joined keywords string into a string array. */
function parseKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

/** Maps a persisted row to the domain Asset (including Phase 22A fields). */
function rowToAsset(row: AssetRow): Asset {
  return {
    assetId: row.assetId,
    category: row.category as AssetCategory,
    region: row.region,
    company: row.company,
    battalion: row.battalion,
    folderName: row.folderName,
    relativePath: row.relativePath,
    driveFileId: row.driveFileId,
    thumbnailUrl: row.thumbnailUrl,
    webViewUrl: row.webViewUrl,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    createdTime: toIso(row.createdTime),
    updatedTime: toIso(row.updatedTime),
    companyId: row.companyId,
    unitName:    row.unitName,
    unitNumber:  row.unitNumber,
    keywords:    parseKeywords(row.keywords),
    description: row.description,
    remarks:     row.remarks,
    verified:    row.verified,
  };
}

/** Maps a domain Asset to the persisted column values (no `assetId` — it is the key). */
function assetToData(asset: Asset): Record<string, unknown> {
  return {
    category: asset.category,
    region: asset.region,
    company: asset.company,
    battalion: asset.battalion,
    folderName: asset.folderName,
    relativePath: asset.relativePath,
    driveFileId: asset.driveFileId,
    thumbnailUrl: asset.thumbnailUrl,
    webViewUrl: asset.webViewUrl,
    imageWidth: asset.imageWidth ?? null,
    imageHeight: asset.imageHeight ?? null,
    createdTime: toDate(asset.createdTime),
    updatedTime: toDate(asset.updatedTime),
    companyId: asset.companyId ?? null,
    unitName:    asset.unitName    ?? null,
    unitNumber:  asset.unitNumber  ?? null,
    keywords:    (asset.keywords ?? []).join(","),
    description: asset.description ?? null,
    remarks:     asset.remarks     ?? null,
    verified:    asset.verified    ?? false,
  };
}

/** Extracts a Prisma `_count` group value. */
function countOf(group: Record<string, unknown>): number {
  const c = group._count;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && "_all" in c) return Number((c as { _all: number })._all);
  return 0;
}

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly db: AssetDbClient) {}

  async upsert(asset: Asset): Promise<{ asset: Asset; created: boolean }> {
    const existing = await this.db.asset.findUnique({ where: { assetId: asset.assetId } });
    const data = assetToData(asset);
    const row = await this.db.asset.upsert({
      where: { assetId: asset.assetId },
      create: { assetId: asset.assetId, ...data },
      update: data,
    });
    return { asset: rowToAsset(row), created: existing === null };
  }

  async findById(assetId: string): Promise<Asset | null> {
    const row = await this.db.asset.findUnique({ where: { assetId } });
    return row ? rowToAsset(row) : null;
  }

  /** Builds the Prisma `where` from a query. Reserved PROFILE is always excluded at the DB level. */
  private buildWhere(query: AssetQuery): Record<string, unknown> {
    const where: Record<string, unknown> = { category: { not: AssetCategory.Profile } };
    if (query.category !== undefined) where.category = query.category;
    if (query.region) where.region = query.region;
    if (query.company) where.company = query.company;
    if (query.battalion) where.battalion = query.battalion;
    if (query.companyId !== undefined) where.companyId = query.companyId;
    if (query.verified  !== undefined) where.verified  = query.verified;
    if (query.search) {
      const mode = "insensitive";
      const value = query.search;
      const filter =
        query.match === "exact"
          ? { equals: value, mode }
          : query.match === "startsWith"
            ? { startsWith: value, mode }
            : { contains: value, mode };
      // Phase 19F+22A: search across all organisational and editorial fields so
      // users can find assets by company ("414"), battalion ("44"), region
      // ("ภาค 4"), unit name/number, keywords, description, or remarks.
      where.OR = [
        { folderName:   filter },
        { relativePath: filter },
        { region:       filter },
        { company:      filter },
        { battalion:    filter },
        { unitName:     filter },
        { unitNumber:   filter },
        { keywords:     filter },
        { description:  filter },
        { remarks:      filter },
      ];
    }
    return where;
  }

  async list(query: AssetQuery): Promise<PaginatedAssets> {
    const where = this.buildWhere(query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const sortBy = query.sortBy ?? "folderName";
    const sortOrder = query.sortOrder ?? "desc";

    const [rows, total] = await Promise.all([
      this.db.asset.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * pageSize, take: pageSize }),
      this.db.asset.count({ where }),
    ]);

    return {
      data: rows.map(rowToAsset),
      total,
      page,
      pageSize,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    };
  }

  async categoryCounts(): Promise<AssetCategoryCount[]> {
    const groups = await this.db.asset.groupBy({
      by: ["category"],
      where: { category: { not: AssetCategory.Profile } },
      _count: { _all: true },
    });
    return groups
      .map((g) => ({ category: String(g.category) as AssetCategory, count: countOf(g) }))
      .filter((c) => isGalleryCategory(c.category))
      .sort((a, b) => b.count - a.count);
  }

  async regionCounts(category?: AssetCategory): Promise<AssetFacetCount[]> {
    const where: Record<string, unknown> = { category: { not: AssetCategory.Profile }, region: { not: null } };
    if (category !== undefined) where.category = category;
    return this.facet("region", where);
  }

  async companyCounts(filter?: { category?: AssetCategory; region?: string }): Promise<AssetFacetCount[]> {
    const where: Record<string, unknown> = { category: { not: AssetCategory.Profile }, company: { not: null } };
    if (filter?.category !== undefined) where.category = filter.category;
    if (filter?.region !== undefined) where.region = filter.region;
    return this.facet("company", where);
  }

  private async facet(field: "region" | "company", where: Record<string, unknown>): Promise<AssetFacetCount[]> {
    const groups = await this.db.asset.groupBy({ by: [field], where, _count: { _all: true } });
    return groups
      .map((g) => ({ value: String(g[field] ?? ""), count: countOf(g) }))
      .filter((f) => f.value.length > 0)
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }

  count(): Promise<number> {
    return this.db.asset.count();
  }

  async updateMetadata(assetId: string, patch: AssetMetadataPatch): Promise<Asset | null> {
    const existing = await this.db.asset.findUnique({ where: { assetId } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if ("region"      in patch) data.region      = patch.region;
    if ("battalion"   in patch) data.battalion   = patch.battalion;
    if ("company"     in patch) data.company     = patch.company;
    if ("unitName"    in patch) data.unitName    = patch.unitName;
    if ("unitNumber"  in patch) data.unitNumber  = patch.unitNumber;
    if ("keywords"    in patch) data.keywords    = (patch.keywords ?? []).join(",");
    if ("description" in patch) data.description = patch.description;
    if ("remarks"     in patch) data.remarks     = patch.remarks;
    if ("verified"    in patch) data.verified    = patch.verified;

    if (Object.keys(data).length === 0) return rowToAsset(existing);

    const row = await this.db.asset.update({ where: { assetId }, data });
    return rowToAsset(row);
  }
}
