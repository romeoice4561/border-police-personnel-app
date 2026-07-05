/**
 * AssetBuilder (Phase 19A — Gallery Foundation).
 *
 * Bridges Drive DISCOVERY metadata (DriveScanEntry, Phase 18B) into the
 * Gallery Asset model. It:
 *   - maps DriveContentType → AssetCategory (asset_category),
 *   - parses region/company/battalion from the folder hierarchy
 *     (asset_metadata; never OCR),
 *   - derives stored Drive image URLs from the file id
 *     (buildOfficerPhoto — reused, no Drive API call, no re-download).
 *
 * It NEVER touches OCR, OpenAI, the officer pipeline, or the DB. Pure mapping:
 * DriveScanEntry → Asset. Profile-category entries are intentionally still
 * mappable (so counts are lossless), but the Gallery service filters them out.
 *
 * Pure functions — no I/O, no globals.
 */

import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { assetCategoryFromContentType } from "@/lib/gallery/asset_category";
import { parseAssetPlacement } from "@/lib/gallery/asset_metadata";
import { buildOfficerPhoto } from "@/lib/google-drive/drive_photo_url";
import type { Asset } from "@/lib/gallery/asset_types";

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * The folder-name chain an asset lives under, derived from its relativePath.
 * `relativePath` is "<folder>/<...>/<file>", so the folder segments are every
 * part except the last (the filename).
 */
export function folderChainFromRelativePath(relativePath: string): string[] {
  const parts = relativePath.split("/").filter((p) => p.length > 0);
  return parts.slice(0, Math.max(0, parts.length - 1));
}

/** Deterministic asset id: prefer the Drive file id, else the relative path. */
function deriveAssetId(entry: DriveScanEntry): string {
  return nonEmpty(entry.id) ?? entry.relativePath;
}

/**
 * Builds a Gallery Asset from a discovered DriveScanEntry. Region/company
 * prefer the scanner's already-resolved values (from the FolderMapper) and fall
 * back to parsing the folder chain; battalion is parsed from the chain (the
 * officer FolderMapper does not expose it as a unit here).
 */
export function assetFromScanEntry(entry: DriveScanEntry): Asset {
  const chain = folderChainFromRelativePath(entry.relativePath);
  const parsed = parseAssetPlacement([entry.top_level_folder, ...chain]);
  const photo = buildOfficerPhoto({ driveFileId: entry.id });

  return {
    assetId: deriveAssetId(entry),
    category: assetCategoryFromContentType(entry.content_type),
    region: nonEmpty(entry.region) ?? parsed.region,
    company: nonEmpty(entry.company) ?? parsed.company,
    battalion: parsed.battalion,
    folderName: nonEmpty(entry.top_level_folder),
    relativePath: entry.relativePath,
    driveFileId: photo.driveFileId,
    thumbnailUrl: photo.thumbnailUrl,
    webViewUrl: photo.webViewUrl,
    imageWidth: null,
    imageHeight: null,
    createdTime: nonEmpty(entry.createdTime),
    updatedTime: nonEmpty(entry.modifiedTime),
  };
}

/**
 * Maps a batch of discovered entries to assets, keeping only IMAGE files. This
 * is a pure transform — persisting the result is the repository's job (deferred
 * to a later phase; no DB writes here).
 */
export function assetsFromScanEntries(entries: DriveScanEntry[]): Asset[] {
  return entries.filter((e) => e.isImage).map(assetFromScanEntry);
}
