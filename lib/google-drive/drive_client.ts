/**
 * DriveClient
 *
 * Provider-agnostic contract for listing folders/files from a remote drive.
 * No Google SDK is used or required here — this is the seam a real
 * `googleapis`-backed implementation plugs into later, and the same
 * contract is designed to be implementable by a future OneDrive or
 * SharePoint client (see docs/GOOGLE_DRIVE_ARCHITECTURE.md, "Future
 * Providers").
 *
 * No credentials are required or referenced by this interface; a real
 * implementation would accept auth via its own constructor, not through
 * this contract.
 */

import type { DriveFileMetadata, DriveFolder } from "@/lib/google-drive/drive_types";

/** Options for listing children of a folder. */
export interface ListFolderOptions {
  /** Provider page token for paginated listings, if supported. */
  pageToken?: string;
  pageSize?: number;
}

/** A single page of folder-listing results, supporting pagination for large folders. */
export interface ListFolderPage {
  files: DriveFileMetadata[];
  subfolders: DriveFolder[];
  nextPageToken?: string;
}

/** Contract every drive provider client must implement. */
export interface DriveClient {
  /** Fetches metadata for a single folder by id. */
  getFolder(folderId: string): Promise<DriveFolder>;

  /** Lists immediate children (files and subfolders) of a folder, one page at a time. */
  listFolderChildren(folderId: string, options?: ListFolderOptions): Promise<ListFolderPage>;

  /** Fetches metadata for a single file by id. */
  getFile(fileId: string): Promise<DriveFileMetadata>;

  /**
   * Returns a provider change token representing "now", for use as the
   * starting point of a future incremental sync (mirrors Drive API's
   * `changes.getStartPageToken`). Optional — providers without native
   * change tracking may omit support and IncrementalSync falls back to
   * full-listing comparison.
   */
  getStartPageToken?(): Promise<string>;
}

/**
 * In-memory fake DriveClient for local development and tests. Holds a
 * fixed set of folders/files supplied at construction time; performs no
 * network calls.
 *
 * Future extension point: replace with a real implementation backed by the
 * `googleapis` Drive v3 client (or a OneDrive/SharePoint SDK), behind this
 * same `DriveClient` interface.
 */
export class InMemoryDriveClient implements DriveClient {
  constructor(
    private readonly folders: Map<string, DriveFolder>,
    private readonly filesByFolder: Map<string, DriveFileMetadata[]>,
    private readonly subfoldersByFolder: Map<string, DriveFolder[]> = new Map()
  ) {}

  async getFolder(folderId: string): Promise<DriveFolder> {
    const folder = this.folders.get(folderId);
    if (!folder) throw new Error(`Unknown folder: ${folderId}`);
    return folder;
  }

  async listFolderChildren(folderId: string): Promise<ListFolderPage> {
    return {
      files: this.filesByFolder.get(folderId) ?? [],
      subfolders: this.subfoldersByFolder.get(folderId) ?? [],
      nextPageToken: undefined,
    };
  }

  async getFile(fileId: string): Promise<DriveFileMetadata> {
    for (const files of this.filesByFolder.values()) {
      const match = files.find((file) => file.id === fileId);
      if (match) return match;
    }
    throw new Error(`Unknown file: ${fileId}`);
  }

  async getStartPageToken(): Promise<string> {
    return `token-${Date.now()}`;
  }
}
