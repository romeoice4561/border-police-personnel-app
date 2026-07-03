/**
 * Shared types for the Google Drive Scanner (Phase 4).
 *
 * Pure domain typing — no Google SDK, no credentials, no network calls.
 * Interfaces here are provider-agnostic where practical, so a future
 * OneDrive or SharePoint scanner can implement the same contracts (see
 * docs/GOOGLE_DRIVE_ARCHITECTURE.md, "Future Providers").
 */

/** MIME types this system will ever ingest as personnel profile images. */
export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Raw file metadata as returned by a remote drive provider, prior to any
 * filtering, hashing, or region mapping. Field set matches what the Google
 * Drive API v3 `files.list`/`files.get` calls expose, kept provider-neutral
 * in naming so OneDrive/SharePoint adapters can populate the same shape.
 */
export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  /** Size in bytes, as a string to match Drive API's int64-as-string convention. */
  size: string;
  modifiedTime: string;
  parents: string[];
  webViewLink?: string;
  thumbnailLink?: string;
  /** ISO timestamp the file was created in Drive, if the provider reports it. */
  createdTime?: string;
  /** MD5 checksum reported directly by the provider (e.g. Drive API's `md5Checksum`), when available. Never computed locally in this phase — see hash_generator.ts. */
  md5Checksum?: string;
}

/** A folder node as seen by a provider, before being mapped to an organizational unit. */
export interface DriveFolder {
  id: string;
  name: string;
  parents: string[];
}

/**
 * Organizational placement of a scanned file, resolved by FolderMapper from
 * the raw folder hierarchy. All levels optional since not every deployment
 * will use every level.
 */
export interface OrganizationalUnit {
  region?: string;
  province?: string;
  battalion?: string;
  company?: string;
}

/**
 * Final normalized scan output for a single image, ready to feed the
 * Phase 3 Import Orchestrator (see types/import.ts `ScannedImage`, which
 * this is a superset of — a `toImportScannedImage` adapter is provided in
 * scan_result.ts).
 */
export interface ScannedImage {
  id: string;
  filename: string;
  folder: string;
  region?: string;
  mime: SupportedImageMime;
  hash: string;
  size: number;
  modified: string;
}

/** Supported hash algorithms. See hash_generator.ts. */
export type HashAlgorithm = "sha256" | "md5";

/** Kinds of change IncrementalSync can detect between two scan snapshots. */
export type FileChangeType = "new" | "modified" | "deleted" | "unchanged";

export interface FileChange {
  type: FileChangeType;
  file: DriveFileMetadata;
  previousHash?: string;
  currentHash?: string;
}

/** A point-in-time record of what was known at the last successful sync. */
export interface SyncCheckpoint {
  folderId: string;
  lastScannedAt: string;
  /** Provider-specific page/change token, if the provider supports one (e.g. Drive's `startPageToken`). */
  pageToken?: string;
  /** Known file id -> hash, as of this checkpoint. */
  knownFileHashes: Record<string, string>;
}

/** Result of comparing a fresh scan against a prior SyncCheckpoint. */
export interface IncrementalSyncResult {
  checkpoint: SyncCheckpoint;
  changes: FileChange[];
  newFiles: DriveFileMetadata[];
  modifiedFiles: DriveFileMetadata[];
  deletedFileIds: string[];
}

/** Outcome of duplicate detection across a set of candidate files. */
export interface DuplicateGroup {
  /** The file kept as canonical (e.g. earliest by modifiedTime). */
  canonical: DriveFileMetadata;
  /** Other files considered duplicates of the canonical file. */
  duplicates: DriveFileMetadata[];
  matchedBy: "hash" | "filename" | "filesize";
}

/** Reason an image was excluded by ImageFilter. */
export type ImageRejectionReason = "unsupported_mime" | "zero_byte" | "missing_extension";

export interface ImageFilterResult {
  accepted: DriveFileMetadata[];
  rejected: Array<{ file: DriveFileMetadata; reason: ImageRejectionReason }>;
}
