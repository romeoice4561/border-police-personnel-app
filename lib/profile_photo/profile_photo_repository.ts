/**
 * ProfilePhotoRepository (Phase 21C — Universal Profile Photo Inbox).
 *
 * The persistence CONTRACT for ProfilePhoto, plus an in-memory reference
 * implementation. Mirrors the Gallery's AssetRepository pattern exactly: the
 * interface is what ProfilePhotoService depends on (constructor injection),
 * so PrismaProfilePhotoRepository is a drop-in replacement in production
 * while the in-memory impl lets the service/importer be tested without a DB.
 *
 * Upsert is idempotent, keyed on the unique `driveFileId` — re-discovering
 * the same Drive file updates its row in place rather than duplicating it,
 * satisfying "every profile image must create exactly ONE ProfilePhoto
 * record" even across repeated import runs.
 *
 * No OCR, no AI, no Officer table writes, no globals, no singleton.
 */

import type {
  MatchStatusCount,
  PaginatedProfilePhotos,
  ProfilePhoto,
  ProfilePhotoInput,
  ProfilePhotoQuery,
} from "@/lib/profile_photo/profile_photo_types";
import { MatchStatus } from "@/lib/profile_photo/profile_photo_types";

export interface ProfilePhotoRepository {
  /** Idempotent upsert keyed on driveFileId. Returns whether the photo was newly created. */
  upsert(input: ProfilePhotoInput): Promise<{ photo: ProfilePhoto; created: boolean }>;
  findByDriveFileId(driveFileId: string): Promise<ProfilePhoto | null>;
  findById(id: number): Promise<ProfilePhoto | null>;
  list(query: ProfilePhotoQuery): Promise<PaginatedProfilePhotos>;
  /** Per-matchStatus counts — drives the future Inbox's filter chips (Part 6). */
  matchStatusCounts(): Promise<MatchStatusCount[]>;
  count(): Promise<number>;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export class InMemoryProfilePhotoRepository implements ProfilePhotoRepository {
  private readonly photos = new Map<string, ProfilePhoto>();
  private nextId = 1;

  constructor(seed: ProfilePhoto[] = []) {
    for (const p of seed) {
      this.photos.set(p.driveFileId, p);
      this.nextId = Math.max(this.nextId, p.id + 1);
    }
  }

  async upsert(input: ProfilePhotoInput): Promise<{ photo: ProfilePhoto; created: boolean }> {
    const existing = this.photos.get(input.driveFileId);
    const now = new Date().toISOString();
    const photo: ProfilePhoto = existing
      ? { ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
      : { ...input, id: this.nextId++, createdAt: now, updatedAt: now };
    this.photos.set(input.driveFileId, photo);
    return { photo, created: !existing };
  }

  async findByDriveFileId(driveFileId: string): Promise<ProfilePhoto | null> {
    return this.photos.get(driveFileId) ?? null;
  }

  async findById(id: number): Promise<ProfilePhoto | null> {
    return [...this.photos.values()].find((p) => p.id === id) ?? null;
  }

  async list(query: ProfilePhotoQuery): Promise<PaginatedProfilePhotos> {
    const filtered = [...this.photos.values()].filter((p) => {
      if (query.matchStatus !== undefined && p.matchStatus !== query.matchStatus) return false;
      if (query.region && norm(p.region) !== norm(query.region)) return false;
      if (query.company && norm(p.company) !== norm(query.company)) return false;
      if (query.battalion && norm(p.battalion) !== norm(query.battalion)) return false;
      if (query.search) {
        const needle = norm(query.search);
        const haystack = [p.filename, p.folderPath, p.matchedOfficerId].map(norm).join(" ");
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async matchStatusCounts(): Promise<MatchStatusCount[]> {
    const counts = new Map<MatchStatus, number>();
    for (const p of this.photos.values()) counts.set(p.matchStatus, (counts.get(p.matchStatus) ?? 0) + 1);
    return Object.values(MatchStatus).map((matchStatus) => ({ matchStatus, count: counts.get(matchStatus) ?? 0 }));
  }

  async count(): Promise<number> {
    return this.photos.size;
  }
}
