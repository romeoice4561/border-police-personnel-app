/**
 * ScanResult assembly.
 *
 * Combines raw DriveFileMetadata with a resolved hash and organizational
 * unit into the final ScannedImage shape, and adapts that shape to the
 * simpler `ScannedImage` type Phase 3's Import Orchestrator
 * (types/import.ts) already accepts — so BatchProcessor.processAll can
 * consume Drive Scanner output directly once a real client exists.
 */

import type {
  DriveFileMetadata,
  OrganizationalUnit,
  ScannedImage,
  SupportedImageMime,
} from "@/lib/google-drive/drive_types";
import type { ScannedImage as ImportScannedImage } from "@/types/import";

const SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set<SupportedImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function assertSupportedMime(mimeType: string): SupportedImageMime {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported mime type for ScannedImage: ${mimeType}`);
  }
  return mimeType as SupportedImageMime;
}

/**
 * Builds the Drive-layer ScannedImage from a filtered file, its computed
 * hash, and its resolved organizational unit.
 */
export function buildScannedImage(
  file: DriveFileMetadata,
  hash: string,
  unit: OrganizationalUnit | undefined,
  folderId: string
): ScannedImage {
  return {
    id: file.id,
    filename: file.name,
    folder: folderId,
    region: unit?.region,
    mime: assertSupportedMime(file.mimeType),
    hash,
    size: Number(file.size),
    modified: file.modifiedTime,
  };
}

/**
 * Adapts a Drive-layer ScannedImage down to the minimal shape the Phase 3
 * Import Orchestrator expects ({ filename, hash, source }), so scanner
 * output can be handed directly to `BatchProcessor.processAll`.
 */
export function toImportScannedImage(image: ScannedImage): ImportScannedImage {
  return {
    filename: image.filename,
    hash: image.hash,
    source: image.id,
  };
}
