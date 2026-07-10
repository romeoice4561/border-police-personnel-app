/**
 * ProfilePhotoImporter (Phase 21C — Universal Profile Photo Inbox, Part 3).
 *
 * Replaces the old "match, then import" architecture with:
 *
 *   Drive discovery -> ProfilePhoto (ALWAYS, unconditionally)
 *                    -> Matcher (OPTIONAL, never blocks creation)
 *                    -> Officer link (OPTIONAL, only on AUTO_MATCHED)
 *
 * Every discovered Profile-content image becomes EXACTLY ONE ProfilePhoto
 * record via `ProfilePhotoService.ingest` (idempotent upsert by
 * driveFileId), regardless of whether OCR text/officer signals are
 * supplied, whether OCR failed, whether a match was found, or whether that
 * match is ambiguous/duplicate. This guarantees Phase 21C's invariant: NO
 * PROFILE IMAGE IS EVER LOST.
 *
 * OCR text and officer signals are OPTIONAL INPUTS to `import()` — this
 * class does not run OCR or query the Officer table itself (no OCR engine
 * import, no OrganizationService, no officer repository dependency), so it
 * stays a pure orchestration/mapping layer, exactly like GalleryImporter.
 * The runner script that calls this (a later phase, not built here) is
 * responsible for supplying OCR text and officer signals when available.
 *
 * Never touches the Officer table. Never modifies Officer.driveFileId/
 * thumbnailUrl/webViewUrl (Phase 17B fields are completely unchanged, per
 * Part 4) — `matchedOfficerId` is stored only on the ProfilePhoto row.
 *
 * Dependency-injected — no singleton, no globals. No OCR, no OpenAI.
 */

import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import { driveThumbnailUrl, driveWebViewUrl } from "@/lib/google-drive/drive_photo_url";
import type { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { MatchStatus, OcrStatus, PortraitClassification, PhotoType, type ProfilePhotoInput } from "@/lib/profile_photo/profile_photo_types";
import {
  decideMatchesForPhotos,
  type OfficerSignals,
  type ProfilePhotoMatchResult,
} from "@/lib/profile_photo/profile_photo_matcher";

/** OCR text keyed by Drive file id, supplied by the caller (this class never runs OCR itself). */
export type OcrTextByFileId = Map<string, { text: string; failed: boolean }>;

/** Image-content classification keyed by Drive file id, supplied by the caller (this class never classifies itself). */
export type ClassificationByFileId = Map<string, PortraitClassification>;

export interface ProfilePhotoImportOptions {
  /**
   * OCR text already extracted for some/all of the discovered images, keyed
   * by Drive file id. An entry with `failed: true` records that OCR was
   * attempted and failed (ocrStatus = FAILED) — the photo is still imported.
   * A file id absent from this map is imported with ocrStatus = PENDING (OCR
   * not attempted this run) — never blocks import.
   */
  ocrByFileId?: OcrTextByFileId;
  /**
   * Existing officers to match against. When omitted (or empty), every photo
   * is imported with matchStatus = UNASSIGNED (the matcher never ran) — the
   * import itself is entirely unaffected by whether matching runs.
   */
  officers?: OfficerSignals[];
  /**
   * Phase 24B-3: image-content classification already computed for some/all
   * of the discovered images, keyed by Drive file id (this class never runs
   * the classifier itself — see scripts/rebuild_drive_portraits.ts). A file
   * id absent from this map is imported with classification = UNKNOWN
   * (unchanged default behavior). Classification is METADATA ONLY here — it
   * never affects whether a photo is imported or matched.
   */
  classificationByFileId?: ClassificationByFileId;
}

/** Summary of a Profile Photo import run. */
export interface ProfilePhotoImportSummary {
  discovered: number;
  profileImages: number;
  photos_created: number;
  photos_updated: number;
  ocr_completed: number;
  ocr_failed: number;
  ocr_pending: number;
  matched_auto: number;
  match_review_required: number;
  match_conflict: number;
  match_duplicate: number;
  match_unknown: number;
  match_unassigned: number;
  elapsed_ms: number;
}

export interface ProfilePhotoImporterDependencies {
  service: ProfilePhotoService;
}

export class ProfilePhotoImporter {
  private readonly service: ProfilePhotoService;

  constructor(dependencies: ProfilePhotoImporterDependencies) {
    this.service = dependencies.service;
  }

  /**
   * Imports every PROFILE-content image from a batch of discovered Drive
   * entries. Builds a ProfilePhoto for each (unconditionally — this never
   * filters an image out for any reason), optionally attaches OCR text and a
   * matcher decision when supplied, and idempotently ingests all of them.
   */
  async import(entries: DriveScanEntry[], options: ProfilePhotoImportOptions = {}): Promise<ProfilePhotoImportSummary> {
    const startedAt = Date.now();

    const profileEntries = entries.filter((e) => e.isImage && e.content_type === DriveContentType.Profile);

    const ocrByFileId = options.ocrByFileId ?? new Map();
    const officers = options.officers ?? [];
    const classificationByFileId: ClassificationByFileId = options.classificationByFileId ?? new Map();

    // Matching runs once, in batch, so cross-photo duplicate detection (two
    // photos both plausibly matching the same officer) works exactly as the
    // Phase 21B-2 dry run proved — but ONLY over entries that have OCR text,
    // since matching without any text can never produce a signal anyway.
    const matchableImages = profileEntries
      .filter((e) => ocrByFileId.get(e.id)?.text)
      .map((e) => ({
        fileId: e.id,
        filename: e.name,
        driveFolder: e.relativePath,
        ocrText: ocrByFileId.get(e.id)!.text,
      }));

    const matchResults: Map<string, ProfilePhotoMatchResult> =
      officers.length > 0 && matchableImages.length > 0
        ? decideMatchesForPhotos(officers, matchableImages)
        : new Map();

    const photos: ProfilePhotoInput[] = profileEntries.map((entry) =>
      this.buildPhotoInput(entry, ocrByFileId, matchResults, classificationByFileId)
    );

    const result = await this.service.ingest(photos);

    const tally = {
      ocr_completed: 0,
      ocr_failed: 0,
      ocr_pending: 0,
      match_auto: 0,
      match_review_required: 0,
      match_conflict: 0,
      match_duplicate: 0,
      match_unknown: 0,
      match_unassigned: 0,
    };
    for (const p of photos) {
      if (p.ocrStatus === OcrStatus.Completed) tally.ocr_completed += 1;
      else if (p.ocrStatus === OcrStatus.Failed) tally.ocr_failed += 1;
      else tally.ocr_pending += 1;

      if (p.matchStatus === MatchStatus.AutoMatched) tally.match_auto += 1;
      else if (p.matchStatus === MatchStatus.ReviewRequired) tally.match_review_required += 1;
      else if (p.matchStatus === MatchStatus.Conflict) tally.match_conflict += 1;
      else if (p.matchStatus === MatchStatus.Duplicate) tally.match_duplicate += 1;
      else if (p.matchStatus === MatchStatus.Unknown) tally.match_unknown += 1;
      else tally.match_unassigned += 1;
    }

    return {
      discovered: entries.length,
      profileImages: profileEntries.length,
      photos_created: result.created,
      photos_updated: result.updated,
      ocr_completed: tally.ocr_completed,
      ocr_failed: tally.ocr_failed,
      ocr_pending: tally.ocr_pending,
      matched_auto: tally.match_auto,
      match_review_required: tally.match_review_required,
      match_conflict: tally.match_conflict,
      match_duplicate: tally.match_duplicate,
      match_unknown: tally.match_unknown,
      match_unassigned: tally.match_unassigned,
      elapsed_ms: Date.now() - startedAt,
    };
  }

  private buildPhotoInput(
    entry: DriveScanEntry,
    ocrByFileId: OcrTextByFileId,
    matchResults: Map<string, ProfilePhotoMatchResult>,
    classificationByFileId: ClassificationByFileId
  ): ProfilePhotoInput {
    const ocr = ocrByFileId.get(entry.id);
    const ocrStatus = !ocr ? OcrStatus.Pending : ocr.failed ? OcrStatus.Failed : OcrStatus.Completed;
    const ocrText = ocr && !ocr.failed && ocr.text.trim().length > 0 ? ocr.text : null;

    const match = matchResults.get(entry.id);
    const classification = classificationByFileId.get(entry.id) ?? PortraitClassification.Unknown;

    return {
      driveFileId: entry.id,
      thumbnailUrl: driveThumbnailUrl(entry.id),
      webViewUrl: driveWebViewUrl(entry.id),
      filename: entry.name,
      folderPath: entry.relativePath,
      region: entry.region ?? null,
      company: entry.company ?? null,
      battalion: entry.battalion ?? null,
      ocrText,
      ocrStatus,
      matchStatus: match?.matchStatus ?? MatchStatus.Unassigned,
      matchedOfficerId: match?.matchedOfficerId ?? null,
      confidence: match?.confidence ?? null,
      // Phase 24B-1/24B-2: every Drive-discovered row is a scan, never the
      // current portrait by default. Re-running the importer on an
      // already-discovered row is protected against clobbering human
      // review/manual match/uploads by the repository's upsert (see
      // PrismaProfilePhotoRepository.upsert) — never by this builder.
      sourceType: "DRIVE_SCAN",
      storagePath: null,
      mimeType: null,
      width: null,
      height: null,
      uploadedBy: null,
      isProfile: false,
      classification,
      classifiedBy: null,
      classifiedAt: null,
      // Phase 26A: every Drive-discovered row is the original profile card by
      // default. Protected against regressing on re-import by the
      // repository's upsert (never set by this builder on an existing row).
      photoType: PhotoType.GoogleProfileCard,
    };
  }
}
