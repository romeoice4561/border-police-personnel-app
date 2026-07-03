/**
 * FolderScanner
 *
 * Walks a Drive folder hierarchy (single folder or recursively) and lists
 * the image files found within. Delegates actual metadata retrieval to a
 * DriveClient and file-level filtering to an ImageFilter — this module
 * owns traversal only.
 */

import type { DriveClient } from "@/lib/google-drive/drive_client";
import type { DriveFileMetadata, DriveFolder } from "@/lib/google-drive/drive_types";
import type { ImageFilterEngine } from "@/lib/google-drive/image_filter";
import { MimeImageFilter } from "@/lib/google-drive/image_filter";

/** Result of scanning a folder, optionally including nested folder results when recursive. */
export interface FolderScanResult {
  folder: DriveFolder;
  files: DriveFileMetadata[];
  subfolders: FolderScanResult[];
}

/** Contract for folder scanning. Allows swapping in a different traversal strategy later. */
export interface FolderScannerEngine {
  /** Scans a single folder's immediate children only. */
  scanFolder(folderId: string): Promise<FolderScanResult>;
  /** Scans a folder and all descendant folders. */
  scanRecursive(folderId: string): Promise<FolderScanResult>;
  /** Convenience: scans recursively and returns a flat list of image files only. */
  listImages(folderId: string): Promise<DriveFileMetadata[]>;
}

/**
 * Default folder scanner backed by an injected DriveClient.
 *
 * Future extension point: add pagination-aware traversal for folders with
 * more children than a single page (DriveClient.listFolderChildren already
 * supports a `nextPageToken`; this class should loop until exhausted once a
 * real client is wired in), and add depth/size limits for very large trees.
 */
export class FolderScanner implements FolderScannerEngine {
  constructor(
    private readonly client: DriveClient,
    private readonly imageFilter: ImageFilterEngine = new MimeImageFilter()
  ) {}

  async scanFolder(folderId: string): Promise<FolderScanResult> {
    const folder = await this.client.getFolder(folderId);
    const page = await this.client.listFolderChildren(folderId);

    return {
      folder,
      files: page.files,
      subfolders: [],
    };
  }

  async scanRecursive(folderId: string): Promise<FolderScanResult> {
    const folder = await this.client.getFolder(folderId);
    const page = await this.client.listFolderChildren(folderId);

    const subfolders: FolderScanResult[] = [];
    for (const subfolder of page.subfolders) {
      subfolders.push(await this.scanRecursive(subfolder.id));
    }

    return {
      folder,
      files: page.files,
      subfolders,
    };
  }

  async listImages(folderId: string): Promise<DriveFileMetadata[]> {
    const tree = await this.scanRecursive(folderId);
    return this.flattenImages(tree);
  }

  private flattenImages(result: FolderScanResult): DriveFileMetadata[] {
    const { accepted } = this.imageFilter.filter(result.files);
    const nested = result.subfolders.flatMap((subfolder) => this.flattenImages(subfolder));
    return [...accepted, ...nested];
  }
}
