/**
 * ProfilePhotoService (Phase 21C — Universal Profile Photo Inbox).
 *
 * The application layer for ProfilePhoto: depends on an injected
 * ProfilePhotoRepository (constructor injection — no singleton, no global),
 * exposes the read operations a future Profile Photo Inbox screen (Part 6)
 * and API would consume (list-with-filters, get-by-id, per-matchStatus
 * counts), and an idempotent `ingest` entry point the importer uses.
 *
 * `ingest` NEVER decides whether a photo is worth keeping — every input photo
 * is upserted unconditionally (Phase 21C's core invariant: no image is ever
 * lost). Matching (Part 5) is a separate, optional concern performed by the
 * matcher BEFORE calling ingest, not by this service.
 *
 * No OCR, no AI, no Officer table writes, no globals.
 */

import type { ProfilePhotoRepository } from "@/lib/profile_photo/profile_photo_repository";
import type {
  ClassificationCount,
  MatchStatusCount,
  PaginatedProfilePhotos,
  ProfilePhoto,
  ProfilePhotoInput,
  ProfilePhotoQuery,
} from "@/lib/profile_photo/profile_photo_types";
import type { PortraitClassification } from "@/lib/profile_photo/profile_photo_types";

export interface ProfilePhotoServiceDependencies {
  repository: ProfilePhotoRepository;
}

/** Result of ingesting a batch of Profile Photos (idempotent — reruns update rather than duplicate). */
export interface ProfilePhotoIngestResult {
  created: number;
  updated: number;
}

export class ProfilePhotoService {
  private readonly repository: ProfilePhotoRepository;

  constructor(dependencies: ProfilePhotoServiceDependencies) {
    this.repository = dependencies.repository;
  }

  list(query: ProfilePhotoQuery): Promise<PaginatedProfilePhotos> {
    return this.repository.list(query);
  }

  getById(id: number): Promise<ProfilePhoto | null> {
    return this.repository.findById(id);
  }

  getByDriveFileId(driveFileId: string): Promise<ProfilePhoto | null> {
    return this.repository.findByDriveFileId(driveFileId);
  }

  /** Per-matchStatus counts — drives the future Inbox's filter chips (Part 6: All/Unassigned/Matched/Conflict/Duplicate/Unknown). */
  matchStatusCounts(): Promise<MatchStatusCount[]> {
    return this.repository.matchStatusCounts();
  }

  /** Phase 24B-2: per-classification counts — drives the legacy cleanup tool's filter chips. */
  classificationCounts(): Promise<ClassificationCount[]> {
    return this.repository.classificationCounts();
  }

  /** Phase 24B-2: every ProfilePhoto ever linked to this officer (current + history), newest first. */
  history(officerId: string): Promise<ProfilePhoto[]> {
    return this.repository.historyForOfficer(officerId);
  }

  /**
   * Phase 24B-2: a reviewer classifies what one photo's image actually shows.
   * The resolver immediately respects this — a photo reclassified away from
   * REAL_PERSON can never be shown as a portrait again, even if it was
   * previously the current one (the caller/UI should re-run the resolver
   * after this to reflect any change).
   */
  classify(id: number, classification: PortraitClassification, classifiedBy: string | null): Promise<ProfilePhoto | null> {
    return this.repository.setClassification(id, classification, classifiedBy);
  }

  /**
   * Phase 24B-2: makes photo `id` the officer's current portrait without a
   * new upload — "Set as Current" from the history panel. Demotes every other
   * photo for that officer; never deletes anything.
   */
  setCurrent(id: number): Promise<ProfilePhoto | null> {
    return this.repository.setCurrent(id);
  }

  count(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Idempotently ingests Profile Photos. Every input is upserted
   * unconditionally — this method never filters, skips, or rejects a photo
   * for any reason (OCR failure, no match, duplicate, conflict — all still
   * get a row). Returns created/updated tallies.
   */
  async ingest(photos: ProfilePhotoInput[]): Promise<ProfilePhotoIngestResult> {
    let created = 0;
    let updated = 0;

    for (const photo of photos) {
      const { created: wasCreated } = await this.repository.upsert(photo);
      if (wasCreated) created += 1;
      else updated += 1;
    }

    return { created, updated };
  }
}
