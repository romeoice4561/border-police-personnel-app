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
  MatchStatusCount,
  PaginatedProfilePhotos,
  ProfilePhoto,
  ProfilePhotoInput,
  ProfilePhotoQuery,
} from "@/lib/profile_photo/profile_photo_types";
import { MatchStatus, OcrStatus } from "@/lib/profile_photo/profile_photo_types";
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
    const row = await this.db.profilePhoto.upsert({
      where: { driveFileId: input.driveFileId },
      create: { driveFileId: input.driveFileId, ...data },
      update: data,
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
    if (query.region) where.region = query.region;
    if (query.company) where.company = query.company;
    if (query.battalion) where.battalion = query.battalion;
    if (query.search) {
      const mode = "insensitive";
      const contains = { contains: query.search, mode };
      where.OR = [{ filename: contains }, { folderPath: contains }, { matchedOfficerId: contains }];
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

  count(): Promise<number> {
    return this.db.profilePhoto.count();
  }
}
