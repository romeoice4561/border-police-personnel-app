/**
 * Drive photo URL derivation (Phase 17B).
 *
 * Pure helpers that turn a Google Drive file id into servable image / view
 * URLs using Google's STABLE, WELL-KNOWN URL patterns. It makes NO Drive API
 * call, fetches no metadata, and downloads no bytes — given an id, it returns
 * deterministic URLs. This is the single place Drive photo URLs are built
 * (reused by the import engine and anywhere else), so there is no second
 * implementation.
 *
 * The thumbnail endpoint (`drive.google.com/thumbnail`) serves a sized preview
 * for a file the caller has access to; when the pipeline already captured a
 * provider `thumbnailLink`, that is preferred verbatim over a derived URL.
 *
 * No React, no I/O, no globals.
 */

import type { DriveFileMetadata } from "@/lib/google-drive/drive_types";

/** Default thumbnail width requested from Drive's thumbnail endpoint. */
export const DEFAULT_THUMBNAIL_WIDTH = 256;

/** The officer photo identity persisted to the database. All fields nullable. */
export interface OfficerPhotoIdentity {
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
}

const EMPTY_PHOTO: OfficerPhotoIdentity = { driveFileId: null, thumbnailUrl: null, webViewUrl: null };

function cleanId(fileId: string | null | undefined): string | null {
  return typeof fileId === "string" && fileId.trim().length > 0 ? fileId.trim() : null;
}

/** Derives a sized thumbnail URL for a Drive file id (Google's stable `/thumbnail` endpoint). */
export function driveThumbnailUrl(fileId: string, width: number = DEFAULT_THUMBNAIL_WIDTH): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

/** Derives the human-facing view URL for a Drive file id (Google's stable `/file/d/.../view`). */
export function driveWebViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

/**
 * Builds the officer photo identity from whatever Drive metadata the pipeline
 * captured. Precedence, without ever calling Drive:
 *   - `driveFileId`: an explicit id, else the DriveFileMetadata id.
 *   - `thumbnailUrl`: a captured provider `thumbnailLink`, else derived from the id.
 *   - `webViewUrl`: a captured provider `webViewLink`, else derived from the id.
 * If no id and no links are available, returns all-null (→ UI placeholder).
 */
export function buildOfficerPhoto(source: {
  driveFileId?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  width?: number;
}): OfficerPhotoIdentity {
  const fileId = cleanId(source.driveFileId);
  const thumbnailLink = cleanId(source.thumbnailLink);
  const webViewLink = cleanId(source.webViewLink);

  if (!fileId && !thumbnailLink && !webViewLink) return { ...EMPTY_PHOTO };

  return {
    driveFileId: fileId,
    thumbnailUrl: thumbnailLink ?? (fileId ? driveThumbnailUrl(fileId, source.width ?? DEFAULT_THUMBNAIL_WIDTH) : null),
    webViewUrl: webViewLink ?? (fileId ? driveWebViewUrl(fileId) : null),
  };
}

/** Convenience: build the photo identity directly from a DriveFileMetadata (reusing captured links). */
export function photoFromDriveMetadata(file: DriveFileMetadata, width?: number): OfficerPhotoIdentity {
  return buildOfficerPhoto({
    driveFileId: file.id,
    thumbnailLink: file.thumbnailLink,
    webViewLink: file.webViewLink,
    width,
  });
}

/** The all-null identity, for officers with no Drive image reference. */
export function emptyOfficerPhoto(): OfficerPhotoIdentity {
  return { ...EMPTY_PHOTO };
}
