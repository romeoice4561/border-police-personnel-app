/**
 * ImageFilter
 *
 * Accepts jpg/jpeg/png/webp files; rejects everything else (pdf, doc,
 * video, zip, etc.) before those files ever reach hashing, duplicate
 * detection, or the import pipeline.
 */

import type {
  DriveFileMetadata,
  ImageFilterResult,
  ImageRejectionReason,
  SupportedImageMime,
} from "@/lib/google-drive/drive_types";

const SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set<SupportedImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Contract for an image filter. Allows swapping in a stricter/content-sniffing filter later. */
export interface ImageFilterEngine {
  filter(files: DriveFileMetadata[]): ImageFilterResult;
  isSupported(file: DriveFileMetadata): boolean;
}

/**
 * MIME-type-based image filter.
 *
 * Future extension point: add magic-byte/content sniffing rather than
 * trusting the provider-reported MIME type, once real file bytes are
 * available.
 */
export class MimeImageFilter implements ImageFilterEngine {
  filter(files: DriveFileMetadata[]): ImageFilterResult {
    const accepted: DriveFileMetadata[] = [];
    const rejected: ImageFilterResult["rejected"] = [];

    for (const file of files) {
      const reason = this.rejectionReason(file);
      if (reason) {
        rejected.push({ file, reason });
      } else {
        accepted.push(file);
      }
    }

    return { accepted, rejected };
  }

  isSupported(file: DriveFileMetadata): boolean {
    return this.rejectionReason(file) === undefined;
  }

  private rejectionReason(file: DriveFileMetadata): ImageRejectionReason | undefined {
    if (!SUPPORTED_MIME_TYPES.has(file.mimeType)) {
      return "unsupported_mime";
    }

    if (Number(file.size) <= 0) {
      return "zero_byte";
    }

    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      return "missing_extension";
    }

    return undefined;
  }
}
