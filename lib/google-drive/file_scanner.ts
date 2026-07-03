/**
 * FileScanner
 *
 * Scans a single file's metadata from a DriveClient and extracts the
 * normalized subset of fields the rest of the system depends on: id, name,
 * mimeType, size, modifiedTime, parents, webViewLink, thumbnailLink.
 */

import type { DriveClient } from "@/lib/google-drive/drive_client";
import type { DriveFileMetadata } from "@/lib/google-drive/drive_types";

/** Contract for scanning a single file. Allows swapping in a different metadata source later. */
export interface FileScannerEngine {
  scan(fileId: string): Promise<DriveFileMetadata>;
  extractMetadata(raw: DriveFileMetadata): DriveFileMetadata;
}

/**
 * Default file scanner backed by an injected DriveClient.
 *
 * `extractMetadata` exists as a separate step (rather than folding into
 * `scan`) so a future provider whose raw response shape differs from
 * `DriveFileMetadata` can normalize it here without touching `scan`'s
 * control flow.
 */
export class FileScanner implements FileScannerEngine {
  constructor(private readonly client: DriveClient) {}

  async scan(fileId: string): Promise<DriveFileMetadata> {
    const raw = await this.client.getFile(fileId);
    return this.extractMetadata(raw);
  }

  extractMetadata(raw: DriveFileMetadata): DriveFileMetadata {
    return {
      id: raw.id,
      name: raw.name,
      mimeType: raw.mimeType,
      size: raw.size,
      modifiedTime: raw.modifiedTime,
      parents: raw.parents,
      webViewLink: raw.webViewLink,
      thumbnailLink: raw.thumbnailLink,
    };
  }
}
