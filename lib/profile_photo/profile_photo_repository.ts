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
  ClassificationCount,
  MatchStatusCount,
  PaginatedProfilePhotos,
  ProfilePhoto,
  ProfilePhotoInput,
  ProfilePhotoQuery,
} from "@/lib/profile_photo/profile_photo_types";
import { MatchStatus, PortraitClassification } from "@/lib/profile_photo/profile_photo_types";

export interface ProfilePhotoRepository {
  /** Idempotent upsert keyed on driveFileId. Returns whether the photo was newly created. */
  upsert(input: ProfilePhotoInput): Promise<{ photo: ProfilePhoto; created: boolean }>;
  findByDriveFileId(driveFileId: string): Promise<ProfilePhoto | null>;
  findById(id: number): Promise<ProfilePhoto | null>;
  list(query: ProfilePhotoQuery): Promise<PaginatedProfilePhotos>;
  /** Per-matchStatus counts — drives the future Inbox's filter chips (Part 6). */
  matchStatusCounts(): Promise<MatchStatusCount[]>;
  /** Phase 24B-2: per-classification counts — drives the legacy cleanup tool's filter chips. */
  classificationCounts(): Promise<ClassificationCount[]>;
  /** Phase 24B-2: every ProfilePhoto ever linked to this officer (current + history), newest first. Never filters by matchStatus/classification — history shows everything. */
  historyForOfficer(officerId: string): Promise<ProfilePhoto[]>;
  /**
   * Phase 24B-2: sets `classification` (+ classifiedBy/classifiedAt) on one
   * photo. Returns null if the photo doesn't exist.
   */
  setClassification(id: number, classification: PortraitClassification, classifiedBy: string | null): Promise<ProfilePhoto | null>;
  /**
   * Phase 24B-2: makes photo `id` the current portrait for its
   * matchedOfficerId (isProfile=true) and demotes every other photo for that
   * officer (isProfile=false) — never deletes anything. Returns null if the
   * photo doesn't exist or has no matchedOfficerId.
   */
  setCurrent(id: number): Promise<ProfilePhoto | null>;
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
    // Phase 24B-2: re-importing an already-discovered photo must never
    // regress human review (classification) or the current-portrait flag
    // (isProfile) — mirrors PrismaProfilePhotoRepository.upsert.
    // Phase 24B-3: a rebuild's fresh matcher pass must never overwrite a
    // human-confirmed link (MANUAL_MATCHED) or an uploaded row's link.
    const preserveMatch = existing && (existing.matchStatus === MatchStatus.ManualMatched || existing.sourceType === "UPLOAD");
    const photo: ProfilePhoto = existing
      ? {
          ...existing,
          ...input,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
          classification: existing.classification,
          classifiedBy: existing.classifiedBy,
          classifiedAt: existing.classifiedAt,
          isProfile: existing.isProfile,
          ...(preserveMatch
            ? { matchStatus: existing.matchStatus, matchedOfficerId: existing.matchedOfficerId, confidence: existing.confidence }
            : {}),
        }
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
      if (query.classification !== undefined && p.classification !== query.classification) return false;
      if (query.region && norm(p.region) !== norm(query.region)) return false;
      if (query.company && norm(p.company) !== norm(query.company)) return false;
      if (query.battalion && norm(p.battalion) !== norm(query.battalion)) return false;
      if (query.search) {
        const needle = norm(query.search);
        const haystack = [p.filename, p.folderPath, p.matchedOfficerId, p.driveFileId].map(norm).join(" ");
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

  async classificationCounts(): Promise<ClassificationCount[]> {
    const counts = new Map<PortraitClassification, number>();
    for (const p of this.photos.values()) counts.set(p.classification, (counts.get(p.classification) ?? 0) + 1);
    return Object.values(PortraitClassification).map((classification) => ({
      classification,
      count: counts.get(classification) ?? 0,
    }));
  }

  async historyForOfficer(officerId: string): Promise<ProfilePhoto[]> {
    return [...this.photos.values()]
      .filter((p) => p.matchedOfficerId === officerId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  async setClassification(
    id: number,
    classification: PortraitClassification,
    classifiedBy: string | null
  ): Promise<ProfilePhoto | null> {
    const existing = [...this.photos.values()].find((p) => p.id === id);
    if (!existing) return null;
    const updated: ProfilePhoto = {
      ...existing,
      classification,
      classifiedBy,
      classifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.photos.set(existing.driveFileId, updated);
    return updated;
  }

  async setCurrent(id: number): Promise<ProfilePhoto | null> {
    const target = [...this.photos.values()].find((p) => p.id === id);
    if (!target || !target.matchedOfficerId) return null;
    const now = new Date().toISOString();
    for (const p of this.photos.values()) {
      if (p.matchedOfficerId !== target.matchedOfficerId) continue;
      const isTarget = p.id === id;
      if (p.isProfile === isTarget) continue;
      this.photos.set(p.driveFileId, { ...p, isProfile: isTarget, updatedAt: now });
    }
    return this.photos.get(target.driveFileId) ?? null;
  }

  async count(): Promise<number> {
    return this.photos.size;
  }
}
