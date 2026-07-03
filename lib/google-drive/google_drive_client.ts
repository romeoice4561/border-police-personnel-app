/**
 * GoogleDriveClient
 *
 * Real, read-only `DriveClient` (see drive_client.ts) implementation
 * backed by the Google Drive API v3 via `googleapis`. This is the only
 * concrete class in this phase that makes real network calls to Google —
 * everything else in lib/google-drive (FolderScanner, FileScanner,
 * FolderMapper, ImageFilter, etc.) is reused completely unchanged, exactly
 * as `DriveClient`'s existing interface intended.
 *
 * Read-only: only `files.get`/`files.list` are ever called. No `files.create`,
 * `files.update`, or `files.delete` call exists anywhere in this class.
 *
 * Supports both "My Drive" and Shared Drives via `supportsAllDrives`/
 * `includeItemsFromAllDrives`, and paginates automatically within
 * `listFolderChildren` so callers (FolderScanner) never see a partial page
 * even for folders with many children.
 */

import { google, type drive_v3 } from "googleapis";
import type { Auth } from "googleapis";
import type { DriveClient, ListFolderOptions, ListFolderPage } from "@/lib/google-drive/drive_client";
import type { DriveFileMetadata, DriveFolder } from "@/lib/google-drive/drive_types";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const FILE_FIELDS =
  "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, thumbnailLink, md5Checksum";
const PAGE_SIZE = 1000;

export interface GoogleDriveClientConfig {
  auth: Auth.GoogleAuth;
  /** When true, requests include Shared Drive items (files.list `supportsAllDrives`/`includeItemsFromAllDrives`). */
  supportsSharedDrives?: boolean;
}

/**
 * Translates a raw googleapis error into the project's typed error
 * vocabulary with a readable message, distinguishing the failure modes
 * called out in docs/GOOGLE_DRIVE_LIVE.md (permission denied, not found,
 * rate limited, network timeout, Shared Drive disabled).
 */
function translateDriveError(error: unknown, context: string): never {
  const status = (error as { code?: number; response?: { status?: number } })?.code ??
    (error as { response?: { status?: number } })?.response?.status;

  if (status === 404) {
    throw new DriveProviderError(`${context}: not found (404). Check the folder/file id and that the service account has access.`, 404);
  }
  if (status === 403) {
    throw new DriveProviderError(
      `${context}: permission denied (403). Verify the service account has been granted access to this Drive/folder, ` +
        "and that Shared Drive support is enabled if scanning a Shared Drive.",
      403
    );
  }
  if (status === 429) {
    throw new DriveProviderError(`${context}: rate limited (429) by the Google Drive API. Retry after a short backoff.`, 429);
  }
  if (status === 401) {
    throw new DriveProviderError(`${context}: authentication failed (401). Check GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_DRIVE_CREDENTIALS.`, 401);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(message)) {
    throw new DriveProviderError(`${context}: network error while contacting Google Drive: ${message}`);
  }

  throw new DriveProviderError(`${context}: ${message}`);
}

function toDriveFileMetadata(file: drive_v3.Schema$File): DriveFileMetadata {
  return {
    id: file.id ?? "",
    name: file.name ?? "",
    mimeType: file.mimeType ?? "",
    size: file.size ?? "0",
    modifiedTime: file.modifiedTime ?? "",
    parents: file.parents ?? [],
    webViewLink: file.webViewLink ?? undefined,
    thumbnailLink: file.thumbnailLink ?? undefined,
    createdTime: file.createdTime ?? undefined,
    md5Checksum: file.md5Checksum ?? undefined,
  };
}

function toDriveFolder(file: drive_v3.Schema$File): DriveFolder {
  return {
    id: file.id ?? "",
    name: file.name ?? "",
    parents: file.parents ?? [],
  };
}

export class GoogleDriveClient implements DriveClient {
  private readonly drive: drive_v3.Drive;
  private readonly supportsSharedDrives: boolean;

  constructor(config: GoogleDriveClientConfig) {
    this.drive = google.drive({ version: "v3", auth: config.auth });
    this.supportsSharedDrives = config.supportsSharedDrives ?? true;
  }

  async getFolder(folderId: string): Promise<DriveFolder> {
    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: "id, name, parents",
        supportsAllDrives: this.supportsSharedDrives,
      });
      return toDriveFolder(response.data);
    } catch (error) {
      translateDriveError(error, `Failed to fetch folder ${folderId}`);
    }
  }

  async listFolderChildren(folderId: string, options?: ListFolderOptions): Promise<ListFolderPage> {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: `nextPageToken, files(${FILE_FIELDS})`,
        pageSize: options?.pageSize ?? PAGE_SIZE,
        pageToken: options?.pageToken,
        supportsAllDrives: this.supportsSharedDrives,
        includeItemsFromAllDrives: this.supportsSharedDrives,
        corpora: this.supportsSharedDrives ? "allDrives" : "user",
      });

      const entries = response.data.files ?? [];
      const files: DriveFileMetadata[] = [];
      const subfolders: DriveFolder[] = [];

      for (const entry of entries) {
        if (entry.mimeType === FOLDER_MIME_TYPE) {
          subfolders.push(toDriveFolder(entry));
        } else {
          files.push(toDriveFileMetadata(entry));
        }
      }

      return {
        files,
        subfolders,
        nextPageToken: response.data.nextPageToken ?? undefined,
      };
    } catch (error) {
      translateDriveError(error, `Failed to list children of folder ${folderId}`);
    }
  }

  async getFile(fileId: string): Promise<DriveFileMetadata> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: FILE_FIELDS,
        supportsAllDrives: this.supportsSharedDrives,
      });
      return toDriveFileMetadata(response.data);
    } catch (error) {
      translateDriveError(error, `Failed to fetch file ${fileId}`);
    }
  }

  async getStartPageToken(): Promise<string> {
    try {
      const response = await this.drive.changes.getStartPageToken({
        supportsAllDrives: this.supportsSharedDrives,
      });
      return response.data.startPageToken ?? "";
    } catch (error) {
      translateDriveError(error, "Failed to fetch start page token");
    }
  }

  /**
   * Downloads one file's raw bytes via `files.get` with `alt: "media"` — a
   * read-only call, fully within the `drive.readonly` scope. Returns the
   * bytes as a Buffer; the caller (GoogleDriveImageSource) writes them to a
   * temp file, processes that one image, then deletes it. No file is ever
   * created, updated, or deleted on Drive.
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get(
        {
          fileId,
          alt: "media",
          supportsAllDrives: this.supportsSharedDrives,
        },
        { responseType: "arraybuffer" }
      );
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      translateDriveError(error, `Failed to download file ${fileId}`);
    }
  }
}
