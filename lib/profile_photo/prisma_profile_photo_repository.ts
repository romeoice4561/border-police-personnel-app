/**
 * PrismaProfilePhotoRepository (Phase 21C — Universal Profile Photo Inbox).
 *
 * The production ProfilePhotoRepository, backed by the ProfilePhoto table in
 * Supabase/PostgreSQL. Depends on a narrow, hand-written ProfilePhotoDbClient
 * delegate (mirrors the Gallery's AssetDbClient pattern) rather than the
 * concrete PrismaClient, so it stays decoupled from Prisma's generated types
 * and testable with a fake. Idempotent: upsert is keyed on the unique
 * `driveFileId`.
 */

import type {
  ClassificationCount,
  MatchStatusCount,
  PaginatedProfilePhotos,
  ProfilePhoto,
  ProfilePhotoInput,
  ProfilePhotoQuery,
} from "@/lib/profile_photo/profile_photo_types";
import { MatchStatus, OcrStatus, PortraitClassification } from "@/lib/profile_photo/profile_photo_types";
import type { ProfilePhotoRepository } from "@/lib/profile_photo/profile_photo_repository";

/** A persisted ProfilePhoto row (matches the Prisma ProfilePhoto model). */
export interface ProfilePhotoRow {
  id: number;
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  filename: string;
  folderPath: string;
  region: string | null;
  company: string | null;
  battalion: string | null;
  ocrText: string | null;
  ocrStatus: string;
  matchStatus: string;
  matchedOfficerId: string | null;
  confidence: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  sourceType: string;
  storagePath: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  isProfile: boolean;
  classification: string;
  classifiedBy: string | null;
  classifiedAt: Date | string | null;
}

/** The subset of the Prisma ProfilePhoto delegate this repository uses. Structurally satisfied by PrismaClient.profilePhoto and by fakes. */
export interface ProfilePhotoDelegate {
  findUnique(args: { where: Record<string, unknown> }): Promise<ProfilePhotoRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
    skip?: number;
    take?: number;
  }): Promise<ProfilePhotoRow[]>;
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<ProfilePhotoRow>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<ProfilePhotoRow>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
  groupBy(args: {
    by: string[];
    where?: Record<string, unknown>;
    _count?: boolean | Record<string, boolean>;
  }): Promise<Array<Record<string, unknown>>>;
}

/** The client surface this repository depends on. */
export interface ProfilePhotoDbClient {
  profilePhoto: ProfilePhotoDelegate;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToPhoto(row: ProfilePhotoRow): ProfilePhoto {
  return {
    id: row.id,
    driveFileId: row.driveFileId,
    thumbnailUrl: row.thumbnailUrl,
    webViewUrl: row.webViewUrl,
    filename: row.filename,
    folderPath: row.folderPath,
    region: row.region,
    company: row.company,
    battalion: row.battalion,
    ocrText: row.ocrText,
    ocrStatus: row.ocrStatus as OcrStatus,
    matchStatus: row.matchStatus as MatchStatus,
    matchedOfficerId: row.matchedOfficerId,
    confidence: row.confidence,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    sourceType: row.sourceType,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    uploadedBy: row.uploadedBy,
    isProfile: row.isProfile,
    classification: row.classification as PortraitClassification,
    classifiedBy: row.classifiedBy,
    classifiedAt: row.classifiedAt ? toIso(row.classifiedAt) : null,
  };
}

function photoToData(input: ProfilePhotoInput): Record<string, unknown> {
  return {
    thumbnailUrl: input.thumbnailUrl,
    webViewUrl: input.webViewUrl,
    filename: input.filename,
    folderPath: input.folderPath,
    region: input.region,
    company: input.company,
    battalion: input.battalion,
    ocrText: input.ocrText,
    ocrStatus: input.ocrStatus,
    matchStatus: input.matchStatus,
    matchedOfficerId: input.matchedOfficerId,
    confidence: input.confidence,
    sourceType: input.sourceType,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    uploadedBy: input.uploadedBy,
    isProfile: input.isProfile,
    classification: input.classification,
    classifiedBy: input.classifiedBy,
    classifiedAt: input.classifiedAt,
  };
}

function countOf(group: Record<string, unknown>): number {
  const c = group._count;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && "_all" in c) return Number((c as { _all: number })._all);
  return 0;
}

export class PrismaProfilePhotoRepository implements ProfilePhotoRepository {
  constructor(private readonly db: ProfilePhotoDbClient) {}

  async upsert(input: ProfilePhotoInput): Promise<{ photo: ProfilePhoto; created: boolean }> {
    const existing = await this.db.profilePhoto.findUnique({ where: { driveFileId: input.driveFileId } });
    const data = photoToData(input);
    // Phase 24B-2: re-running the Drive-scan importer on an already-discovered
    // photo must NEVER regress human review (classification) or the
    // current-portrait flag (isProfile) back to the importer's defaults —
    // only create() should ever set those. Scan metadata (region/company/OCR/
    // match/etc.) still refreshes normally on every re-import.
    const updateData: Record<string, unknown> = existing
      ? { ...data, classification: existing.classification, classifiedBy: existing.classifiedBy, classifiedAt: existing.classifiedAt, isProfile: existing.isProfile }
      : data;
    const row = await this.db.profilePhoto.upsert({
      where: { driveFileId: input.driveFileId },
      create: { driveFileId: input.driveFileId, ...data },
      update: updateData,
    });
    return { photo: rowToPhoto(row), created: existing === null };
  }

  async findByDriveFileId(driveFileId: string): Promise<ProfilePhoto | null> {
    const row = await this.db.profilePhoto.findUnique({ where: { driveFileId } });
    return row ? rowToPhoto(row) : null;
  }

  async findById(id: number): Promise<ProfilePhoto | null> {
    const row = await this.db.profilePhoto.findUnique({ where: { id } });
    return row ? rowToPhoto(row) : null;
  }

  async list(query: ProfilePhotoQuery): Promise<PaginatedProfilePhotos> {
    const where: Record<string, unknown> = {};
    if (query.matchStatus !== undefined) where.matchStatus = query.matchStatus;
    if (query.classification !== undefined) where.classification = query.classification;
    if (query.region) where.region = query.region;
    if (query.company) where.company = query.company;
    if (query.battalion) where.battalion = query.battalion;
    if (query.search) {
      const mode = "insensitive";
      const contains = { contains: query.search, mode };
      where.OR = [
        { filename: contains },
        { folderPath: contains },
        { matchedOfficerId: contains },
        { driveFileId: contains },
      ];
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const [rows, total] = await Promise.all([
      this.db.profilePhoto.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.profilePhoto.count({ where }),
    ]);

    return { data: rows.map(rowToPhoto), total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
  }

  async matchStatusCounts(): Promise<MatchStatusCount[]> {
    const groups = await this.db.profilePhoto.groupBy({ by: ["matchStatus"], _count: { _all: true } });
    const byStatus = new Map(groups.map((g) => [String(g.matchStatus) as MatchStatus, countOf(g)]));
    return Object.values(MatchStatus).map((matchStatus) => ({ matchStatus, count: byStatus.get(matchStatus) ?? 0 }));
  }

  async classificationCounts(): Promise<ClassificationCount[]> {
    const groups = await this.db.profilePhoto.groupBy({ by: ["classification"], _count: { _all: true } });
    const byClass = new Map(groups.map((g) => [String(g.classification) as PortraitClassification, countOf(g)]));
    return Object.values(PortraitClassification).map((classification) => ({
      classification,
      count: byClass.get(classification) ?? 0,
    }));
  }

  async historyForOfficer(officerId: string): Promise<ProfilePhoto[]> {
    const rows = await this.db.profilePhoto.findMany({
      where: { matchedOfficerId: officerId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(rowToPhoto);
  }

  async setClassification(
    id: number,
    classification: PortraitClassification,
    classifiedBy: string | null
  ): Promise<ProfilePhoto | null> {
    const existing = await this.db.profilePhoto.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.db.profilePhoto.update({
      where: { id },
      data: { classification, classifiedBy, classifiedAt: new Date() },
    });
    return rowToPhoto(row);
  }

  async setCurrent(id: number): Promise<ProfilePhoto | null> {
    const target = await this.db.profilePhoto.findUnique({ where: { id } });
    if (!target || !target.matchedOfficerId) return null;

    await this.db.profilePhoto.updateMany({
      where: { matchedOfficerId: target.matchedOfficerId, isProfile: true },
      data: { isProfile: false },
    });
    const row = await this.db.profilePhoto.update({ where: { id }, data: { isProfile: true } });
    return rowToPhoto(row);
  }

  count(): Promise<number> {
    return this.db.profilePhoto.count();
  }
}
