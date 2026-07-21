/**
 * Document thumbnail image-source + orientation helpers (Phase 49A.3 fit fix).
 *
 * Prefers the persisted full file URL for uploaded image documents so the
 * card never renders a tiny derived render/thumbnail when a full image exists.
 * webView / HTML page URLs are never used as <img> src. Synthetic upload IDs
 * are never converted into fake Drive URLs.
 */

import { isLandscapeDocumentType } from "@/lib/ui/media_tokens";
import { driveFullImageUrl, isSyntheticFileId } from "@/lib/ui/officer_photo_source";

/** High-res width for Drive/document display sharpness (not the tiny 256 thumb). */
export const DOCUMENT_DISPLAY_RENDER_WIDTH = 1280;

export type DocumentImageOrientation = "portrait" | "landscape" | "square";

export type DocumentImageSourceKind =
  | "full_file"
  | "drive_high_res"
  | "stored_thumbnail"
  | "none";

export interface ResolveDocumentImageSrcInput {
  fileUrl?: string | null | undefined;
  mimeType?: string | null | undefined;
  /** Optional stored thumbnail — used only when no full image URL exists. */
  thumbnailUrl?: string | null | undefined;
  /** Never used as image src (HTML page). Accepted only to assert rejection. */
  webViewUrl?: string | null | undefined;
  /** Genuine Drive file id only — synthetic `upload:…` ids are ignored. */
  driveFileId?: string | null | undefined;
}

export interface ResolvedDocumentImageSrc {
  /** Primary <img> src — full file URL for images when available. */
  imageUrl: string | null;
  /** Optional secondary URL (e.g. stored thumb) if primary fails to load. */
  fallbackUrl: string | null;
  /** Which tier produced imageUrl. */
  sourceKind: DocumentImageSourceKind;
  hasImage: boolean;
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : null;
}

/** True when the URL looks like a Drive/HTML webView page (never an image src). */
export function isDocumentWebViewUrl(url: string | null | undefined): boolean {
  const u = trimOrNull(url);
  if (!u) return false;
  return /\/file\/d\/[^/]+\/view/i.test(u) || /drive\.google\.com\/open\?/i.test(u);
}

/**
 * Optional high-res Supabase render variant of a public object URL.
 * Returned as an enhancement only — primary display prefers the original
 * object URL so intrinsic dimensions match the uploaded scan.
 */
export function supabaseHighResRenderUrl(fileUrl: string, width = DOCUMENT_DISPLAY_RENDER_WIDTH): string | null {
  const OBJECT = "/storage/v1/object/public/";
  const RENDER = "/storage/v1/render/image/public/";
  if (!fileUrl.includes(OBJECT)) return null;
  return fileUrl.replace(OBJECT, RENDER) + `?width=${width}`;
}

/** Upgrade a tiny Drive thumbnail URL to a high-res image URL when possible. */
export function upgradeDriveImageUrl(url: string, width = DOCUMENT_DISPLAY_RENDER_WIDTH): string {
  const match = url.match(/drive\.google\.com\/thumbnail\?[^#]*\bid=([^&]+)/i);
  if (!match) return url;
  const id = decodeURIComponent(match[1]!);
  if (!id || isSyntheticFileId(id)) return url;
  const sizeMatch = url.match(/[?&]sz=w(\d+)/i);
  const current = sizeMatch ? Number(sizeMatch[1]) : 0;
  if (current > 0 && current >= width) return url;
  return driveFullImageUrl(id, width);
}

/**
 * Resolve the best <img> source for a document card thumbnail.
 *
 * Priority:
 *   1. persisted full fileUrl (image MIME) — never a webView page
 *   2. high-resolution Drive image from a genuine driveFileId
 *   3. stored thumbnailUrl
 *   4. none → caller shows PDF/fallback icon
 *
 * Never returns webViewUrl. Never fabricates Drive URLs from synthetic IDs.
 */
export function resolveDocumentImageSrc(input: ResolveDocumentImageSrcInput): ResolvedDocumentImageSrc {
  const fileUrlRaw = trimOrNull(input.fileUrl);
  const thumb = trimOrNull(input.thumbnailUrl);
  const driveId = trimOrNull(input.driveFileId);
  const mime = (input.mimeType ?? "").toLowerCase();
  const isImage = mime.startsWith("image/");

  // Explicitly ignore webView even if mistakenly passed as fileUrl.
  if (fileUrlRaw && isDocumentWebViewUrl(fileUrlRaw)) {
    if (driveId && !isSyntheticFileId(driveId)) {
      const hi = driveFullImageUrl(driveId, DOCUMENT_DISPLAY_RENDER_WIDTH);
      const fallback = thumb && thumb !== hi && !isDocumentWebViewUrl(thumb) ? thumb : null;
      return { imageUrl: hi, fallbackUrl: fallback, sourceKind: "drive_high_res", hasImage: true };
    }
    if (thumb && !isDocumentWebViewUrl(thumb)) {
      return {
        imageUrl: upgradeDriveImageUrl(thumb),
        fallbackUrl: null,
        sourceKind: "stored_thumbnail",
        hasImage: true,
      };
    }
    return { imageUrl: null, fallbackUrl: null, sourceKind: "none", hasImage: false };
  }

  if (fileUrlRaw && isImage) {
    const imageUrl = upgradeDriveImageUrl(fileUrlRaw);
    const fallback =
      thumb && thumb !== imageUrl && !isDocumentWebViewUrl(thumb) ? upgradeDriveImageUrl(thumb) : null;
    return { imageUrl, fallbackUrl: fallback, sourceKind: "full_file", hasImage: true };
  }

  if (driveId && !isSyntheticFileId(driveId)) {
    const hi = driveFullImageUrl(driveId, DOCUMENT_DISPLAY_RENDER_WIDTH);
    // Keep stored thumb verbatim as a distinct lower-res fallback.
    const fallback = thumb && thumb !== hi && !isDocumentWebViewUrl(thumb) ? thumb : null;
    return { imageUrl: hi, fallbackUrl: fallback, sourceKind: "drive_high_res", hasImage: true };
  }

  // Synthetic upload ids must use persisted file/thumb URLs — never Drive.
  if (thumb && !isDocumentWebViewUrl(thumb)) {
    return {
      imageUrl: upgradeDriveImageUrl(thumb),
      fallbackUrl: null,
      sourceKind: "stored_thumbnail",
      hasImage: true,
    };
  }

  return { imageUrl: null, fallbackUrl: null, sourceKind: "none", hasImage: false };
}

/**
 * Orientation from intrinsic pixel size.
 * Near-square (±8%) → "square"; otherwise portrait/landscape by aspect.
 */
export function orientationFromNaturalSize(naturalWidth: number, naturalHeight: number): DocumentImageOrientation {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return "landscape";
  const ratio = naturalWidth / naturalHeight;
  if (ratio >= 0.92 && ratio <= 1.08) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

/**
 * Fallback orientation before the image loads — type registry hint only.
 * Measured natural size always wins after onLoad.
 */
export function fallbackOrientationForDocumentType(documentTypeCode: string): DocumentImageOrientation {
  return isLandscapeDocumentType(documentTypeCode) ? "landscape" : "portrait";
}

/**
 * Single-URL helper for call sites that only need an image src string.
 * Uses full fileUrl for images (not a tiny render URL).
 */
export function deriveDocumentThumbnailUrl(
  fileUrl: string | null | undefined,
  mimeType: string | null | undefined
): string | null {
  return resolveDocumentImageSrc({ fileUrl, mimeType }).imageUrl;
}
