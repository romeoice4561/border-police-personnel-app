/**
 * ProfilePhoto domain types (Phase 21C — Universal Profile Photo Inbox).
 *
 * The ProfilePhoto entity is completely independent from Officer: every
 * discovered image under a "Profile รายบุคคล ..." Drive folder becomes
 * exactly one ProfilePhoto record, regardless of whether OCR succeeds, a
 * name can be found, or a matching officer exists. This guarantees the
 * phase's core invariant — NO PROFILE IMAGE IS EVER LOST — independent of
 * matching quality.
 *
 * Officer.driveFileId/thumbnailUrl/webViewUrl are UNCHANGED (Phase 17B) and
 * remain the source of truth for what the Officer page renders today;
 * ProfilePhoto.matchedOfficerId is an optional, additive link a future phase
 * may use to update them — never automatic, never required.
 *
 * Pure domain typing — no I/O, no OCR engine import, no Prisma import.
 */

/** Whether OCR was attempted/succeeded for this photo. Import always proceeds regardless of this status. */
export enum OcrStatus {
  /** OCR has not been attempted yet (e.g. imported before OCR ran, or OCR deferred). */
  Pending = "PENDING",
  /** OCR ran and produced text (however weak). */
  Completed = "COMPLETED",
  /** OCR was attempted and failed (download error, engine error, corrupt image, etc.). */
  Failed = "FAILED",
}

/**
 * The outcome of attempting to link a ProfilePhoto to an existing Officer.
 * The matcher NEVER decides whether the photo is imported (it always is) —
 * only whether/how it links to an officer.
 */
export enum MatchStatus {
  /** Not yet evaluated by the matcher. */
  Unassigned = "UNASSIGNED",
  /** The matcher found exactly one clear, high-confidence officer match. */
  AutoMatched = "AUTO_MATCHED",
  /** A human reviewer manually linked this photo to an officer (future action — Part 7). */
  ManualMatched = "MANUAL_MATCHED",
  /** Two or more officer candidates are ambiguous (too close to call automatically). */
  Conflict = "CONFLICT",
  /** Another ProfilePhoto already claims the same top-candidate officer at equal/higher confidence. */
  Duplicate = "DUPLICATE",
  /** The matcher ran but found no signal linking this photo to any officer. */
  Unknown = "UNKNOWN",
  /** Matched with some confidence, but below the safe-match threshold — needs a human to confirm. */
  ReviewRequired = "REVIEW_REQUIRED",
}

/** One imported Profile Photo. Independent of Officer — see module docstring. */
export interface ProfilePhoto {
  id: number;
  /** Google Drive file id — the deterministic idempotent upsert key. */
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  filename: string;
  /** Full relative path under the Drive scan root (e.g. "Profile รายบุคคล ภาค 1/38.png"). */
  folderPath: string;
  region: string | null;
  company: string | null;
  battalion: string | null;
  /** Raw OCR text extracted from the image, when OCR completed. Null if pending/failed. */
  ocrText: string | null;
  ocrStatus: OcrStatus;
  matchStatus: MatchStatus;
  /** The officer this photo is linked to, when matchStatus is AUTO_MATCHED or MANUAL_MATCHED. */
  matchedOfficerId: string | null;
  /** Confidence (0-100) of the match, when matchStatus indicates a candidate was found. Null otherwise. */
  confidence: number | null;
  createdAt: string;
  updatedAt: string;

  // Phase 24B-1 (Officer Portrait Upload) — additive.
  /** How this row entered the system: "DRIVE_SCAN" (discovered by the importer) or "UPLOAD" (via the Officer Profile). */
  sourceType: string;
  /** Supabase Storage object path for an uploaded portrait; null for Drive-scanned rows. */
  storagePath: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  /** Whether this is the CURRENT portrait for matchedOfficerId. Old portraits are demoted, never deleted. */
  isProfile: boolean;

  // Phase 24B-2 (Legacy Portrait Verification) — additive.
  /** What the image content actually shows, independent of matchStatus. Default UNKNOWN until reviewed. */
  classification: PortraitClassification;
  /** Reviewer actor id who set `classification`; null until classified. */
  classifiedBy: string | null;
  /** When `classification` was last set; null until classified. */
  classifiedAt: string | null;

  // Phase 26A (Official Portrait Architecture) — additive.
  /** What this image fundamentally IS — see PhotoType. Default GOOGLE_PROFILE_CARD (every pre-26A row came from the Phase 25 Drive rebuild). */
  photoType: PhotoType;
}

/** Input to create/update one ProfilePhoto (everything except id/createdAt/updatedAt, which the repository owns). */
export type ProfilePhotoInput = Omit<ProfilePhoto, "id" | "createdAt" | "updatedAt">;

/** Filter/query parameters for listing ProfilePhotos (Part 6 — Review Queue architecture). */
export interface ProfilePhotoQuery {
  matchStatus?: MatchStatus;
  region?: string;
  company?: string;
  battalion?: string;
  /** Phase 24B-2: filter by image-content classification (e.g. list all UNKNOWN/MAP/ORGANIZATION for the cleanup tool). */
  classification?: PortraitClassification;
  /** Free-text match against filename / folderPath / matchedOfficerId. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProfilePhotos {
  data: ProfilePhoto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Count of ProfilePhotos per matchStatus — drives the future Inbox's filter chips (Part 6). */
export interface MatchStatusCount {
  matchStatus: MatchStatus;
  count: number;
}

/**
 * What the IMAGE ITSELF actually shows (Phase 24B-2), independent of
 * matchStatus (who/what it's linked to) and sourceType (how it entered the
 * system). Set by a Gallery reviewer via the verification UI, or implicitly
 * REAL_PERSON for an officer-uploaded portrait. The resolver's "Verified
 * Drive Portrait" tier requires REAL_PERSON; every other non-UNKNOWN value is
 * a hard exclusion — that photo can never become an officer's portrait,
 * regardless of matchStatus.
 */
export enum PortraitClassification {
  /** Not yet reviewed (the default for every existing/legacy row). */
  Unknown = "UNKNOWN",
  /** Confirmed to show an actual person's portrait. */
  RealPerson = "REAL_PERSON",
  /** A composite profile card (photo + printed text/ID layout), not a clean portrait. */
  ProfileCard = "PROFILE_CARD",
  /** An organization chart / unit structure diagram. */
  Organization = "ORGANIZATION",
  /** A map (deployment map, area map, etc). */
  Map = "MAP",
  /** A scanned document (GP7, order, certificate, ...). */
  Document = "DOCUMENT",
}

/** Classifications that must NEVER be shown as an officer's portrait. */
export const NON_PORTRAIT_CLASSIFICATIONS: readonly PortraitClassification[] = [
  PortraitClassification.ProfileCard,
  PortraitClassification.Organization,
  PortraitClassification.Map,
  PortraitClassification.Document,
];

/** Count of ProfilePhotos per classification — drives the legacy cleanup tool's filter chips. */
export interface ClassificationCount {
  classification: PortraitClassification;
  count: number;
}

/**
 * What this image fundamentally IS (Phase 26A — Official Portrait
 * Architecture), independent of `classification` (what a reviewer verified
 * the content shows) and `isProfile`/matchStatus (which row the automatic
 * resolver currently prefers). Officer.officialPortraitId is the single
 * source of truth for "the official portrait"; photoType is descriptive
 * metadata the Photo Gallery groups by.
 */
export enum PhotoType {
  /** The original Drive-scanned profile card (Phase 25 rebuild default). MUST NEVER be overwritten or deleted — permanent historical document. */
  GoogleProfileCard = "GOOGLE_PROFILE_CARD",
  /** Explicitly designated as the officer's official photo. */
  OfficialPortrait = "OFFICIAL_PORTRAIT",
  /** A manual upload not (yet) designated official. */
  Uploaded = "UPLOADED",
  /** Anything else. */
  Other = "OTHER",
}
