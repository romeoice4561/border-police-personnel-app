/**
 * Gallery asset download helpers (Phase 49A.3A hotfix).
 *
 * Gallery preview images are served from cross-origin Drive thumbnail URLs.
 * Browsers ignore the HTML `download` attribute on cross-origin anchors and
 * block client-side fetch→blob without CORS — so the PhotoModal Download
 * button appeared to do nothing. Downloads go through a same-origin API
 * proxy that streams the bytes with Content-Disposition: attachment.
 *
 * Pure helpers — no I/O. The route handler performs the upstream fetch.
 */

import { toDownloadName } from "@/lib/ui/download_file";
import { resolveViewerSource } from "@/lib/ui/officer_photo_source";
import type { Asset } from "@/lib/gallery/asset_types";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

/** Extract a lowercase file extension from a path/name, defaulting to jpg. */
export function extensionFromPath(pathOrName: string | null | undefined, fallback = "jpg"): string {
  const base = (pathOrName ?? "").split(/[/\\]/).pop() ?? "";
  const m = base.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1]!.toLowerCase() : fallback;
}

/** MIME type for a file extension (gallery images + PDF). */
export function mimeTypeFromExtension(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Builds a download filename from the asset's original path / folder name.
 * Preserves a real extension when present; otherwise defaults to .jpg.
 */
export function galleryAssetDownloadFilename(asset: Pick<Asset, "assetId" | "relativePath" | "folderName">): string {
  const leaf = asset.relativePath.split(/[/\\]/).pop()?.trim() || "";
  const ext = extensionFromPath(leaf || asset.folderName, "jpg");
  const stemSource =
    leaf.replace(new RegExp(`\\.${ext}$`, "i"), "") ||
    (asset.folderName ?? "").trim() ||
    asset.assetId;
  return toDownloadName(stemSource, { ext });
}

/** ASCII-only fallback for the Content-Disposition `filename=` parameter. */
export function asciiFallbackDownloadFilename(filename: string, mimeType: string): string {
  const asciiOnly = filename.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "").trim();
  // After stripping non-ASCII, Thai names often leave only ".jpg" — treat as empty.
  const stem = asciiOnly.replace(/\.[a-zA-Z0-9]{1,8}$/, "").replace(/^\.+/, "").trim();
  if (stem.length > 0) return asciiOnly;
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1] ?? "bin";
  return `gallery-asset.${ext}`;
}

/**
 * Same-origin download URL for a Gallery asset (used by PhotoModal).
 * The browser fetches this path; the API proxies the upstream image bytes.
 */
export function galleryAssetDownloadApiPath(assetId: string): string {
  return `/api/gallery/assets/${encodeURIComponent(assetId)}/download`;
}

/**
 * Upstream image URLs to try (high-res first, then stored thumbnail).
 * Never returns a webView HTML page URL.
 */
export function galleryAssetUpstreamImageUrls(asset: Pick<Asset, "driveFileId" | "thumbnailUrl" | "webViewUrl">): string[] {
  const source = resolveViewerSource({
    driveFileId: asset.driveFileId,
    thumbnailUrl: asset.thumbnailUrl,
    webViewUrl: asset.webViewUrl,
  });
  const urls: string[] = [];
  if (source.imageUrl) urls.push(source.imageUrl);
  if (source.fallbackUrl && source.fallbackUrl !== source.imageUrl) urls.push(source.fallbackUrl);
  return urls;
}
