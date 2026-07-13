/**
 * Officer photo source resolution for the full-resolution viewer (Phase 18A).
 *
 * Pure, client-safe helpers that pick the best image URL to display in the
 * viewer from the ALREADY-STORED photo identity (driveFileId / thumbnailUrl /
 * webViewUrl). It NEVER calls a Google API, fetches metadata, or re-downloads —
 * it only derives Google's stable, well-known image URL from the file id, in
 * the same spirit as lib/google-drive/drive_photo_url.ts but with no server
 * imports so it is safe in a client component.
 *
 * Source precedence for the viewer's "original" image:
 *   1. a high-resolution image derived from `driveFileId`
 *      (drive.google.com/thumbnail?id=…&sz=w2048 — serves the real image bytes,
 *      unlike webViewUrl which is an HTML page and cannot render in <img>);
 *   2. the stored `thumbnailUrl` as a fallback (lower res, but a real image);
 *   3. none → the viewer shows a placeholder.
 *
 * `webViewUrl` is exposed as the "Open in Drive" link (it is a viewer page, not
 * an image), never as the <img> src.
 */

/** Requested width for the full-resolution viewer image. Large enough to inspect detail. */
export const FULL_RESOLUTION_WIDTH = 2048;

export interface OfficerPhotoInput {
  driveFileId?: string | null;
  thumbnailUrl?: string | null;
  webViewUrl?: string | null;
}

export interface ResolvedViewerSource {
  /** The best available image URL to render in the viewer, or null for placeholder. */
  imageUrl: string | null;
  /** A lower-res fallback image URL to try if `imageUrl` fails to load, or null. */
  fallbackUrl: string | null;
  /** The Drive "view" page URL (HTML), for an "Open in Drive" action. Never an <img> src. */
  webViewUrl: string | null;
  /** True when there is any image to show. */
  hasImage: boolean;
}

function clean(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Derives a high-resolution image URL for a Drive file id (real image bytes, no API call). */
export function driveFullImageUrl(fileId: string, width: number = FULL_RESOLUTION_WIDTH): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

/**
 * Returns true for synthetic file-ID values that are NOT real Google Drive IDs.
 * Synthetic IDs use a "prefix:value" convention (e.g. "upload:<uuid>").
 * Real Drive IDs are alphanumeric + hyphens/underscores and never contain a colon.
 */
export function isSyntheticFileId(fileId: string): boolean {
  return fileId.includes(":");
}

/**
 * Resolves the viewer image source from the stored photo identity, applying the
 * documented precedence. Pure — deterministic URLs, no network.
 */
export function resolveViewerSource(input: OfficerPhotoInput, width: number = FULL_RESOLUTION_WIDTH): ResolvedViewerSource {
  const fileId = clean(input.driveFileId);
  const thumb = clean(input.thumbnailUrl);
  const webView = clean(input.webViewUrl);

  // Only generate a Drive URL for genuine Google Drive file IDs.
  // Synthetic IDs (e.g. "upload:<uuid>") must fall through to thumbnailUrl so
  // the <img> src is the Supabase render URL, not an invalid Drive path.
  const fullFromId = fileId && !isSyntheticFileId(fileId) ? driveFullImageUrl(fileId, width) : null;

  // Primary: high-res from the file id; else the stored thumbnail.
  const imageUrl = fullFromId ?? thumb;
  // Fallback: if we derived a high-res URL, fall back to the stored thumbnail
  // when that high-res URL fails; if we're already on the thumbnail, no further
  // image fallback exists.
  const fallbackUrl = fullFromId && thumb && thumb !== fullFromId ? thumb : null;

  return {
    imageUrl,
    fallbackUrl,
    webViewUrl: webView,
    hasImage: Boolean(imageUrl),
  };
}
