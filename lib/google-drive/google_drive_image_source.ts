/**
 * GoogleDriveImageSource
 *
 * Phase 9C — sources personnel profile images from a live Google Drive tree
 * instead of the local filesystem, behind the exact same
 * `ImageSource`/`DiscoveredImage` contract (lib/import/image_source.ts) the
 * Phase 9A filesystem source already satisfies. Nothing downstream of
 * discovery (region detection, processing, resume, output, reporting)
 * changes — this class is the only new seam.
 *
 * Reuse, not duplication: discovery delegates entirely to the existing
 * `DriveScanReportBuilder`, which itself walks the existing
 * `FolderScanner.scanRecursive()` tree, classifies files with the existing
 * `MimeImageFilter`, and resolves region/province/battalion/company via an
 * injected `FolderMapperEngine` (the existing `DepthBasedFolderMapper`).
 * There is no bespoke scanning, filtering, or mapping logic here — this
 * class only adapts that report into `DiscoveredImage[]` and adds
 * lazy per-image byte download.
 *
 * Lazy download (never the whole Drive): `discover()`/`discoverImages()`
 * reads metadata only. Bytes for a single image are fetched on demand in
 * `openImage()` via the injected client's read-only `downloadFile()`, written
 * to a unique temp file, and deleted by the returned `OpenedImage.dispose()`
 * once processing of that one image finishes. At most one image's bytes
 * exist on local disk at a time under normal sequential use.
 *
 * Read-only: every Drive call reached from here (folder scan + single-file
 * media download) is a read; the client is authenticated with the
 * `drive.readonly` scope. No create/update/delete call exists in this class
 * or anything it depends on.
 *
 * Dependency injection: all collaborators (drive client, folder scanner,
 * folder mapper, report builder, image filter, temp directory) are supplied
 * via the constructor. No singleton, no module-level/global state.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { DriveClient } from "@/lib/google-drive/drive_client";
import { FolderScanner, type FolderScannerEngine } from "@/lib/google-drive/folder_scanner";
import { DepthBasedFolderMapper } from "@/lib/google-drive/folder_path_mapper";
import type { FolderMapperEngine } from "@/lib/google-drive/folder_mapper";
import { MimeImageFilter, type ImageFilterEngine } from "@/lib/google-drive/image_filter";
import { DriveScanReportBuilder, type DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { DriveProviderError } from "@/lib/google-drive/drive_errors";
import {
  openLocalImage,
  type DiscoveredImage,
  type DiscoveryResult,
  type ImageSource,
  type OpenedImage,
  type SkippedFile,
} from "@/lib/import/image_source";

export interface GoogleDriveImageSourceConfig {
  /** The Drive folder id to scan (root of the region/province/battalion/company hierarchy). */
  rootFolderId: string;
  /** Read-only Drive client capable of listing folders and downloading a single file. */
  client: DriveClient;
  /** Whether the root resolves under a Shared Drive; forwarded to the scan report only. */
  sharedDrive?: boolean;
  /**
   * Optional overrides — all default to the existing modules, so a caller
   * normally passes only { rootFolderId, client }. Present for testability
   * and to keep every collaborator injectable (no globals).
   */
  folderScanner?: FolderScannerEngine;
  folderMapper?: FolderMapperEngine;
  imageFilter?: ImageFilterEngine;
  reportBuilder?: DriveScanReportBuilder;
  /** Directory temp image files are written to. Defaults to the OS temp dir. */
  tempDir?: string;
}

export class GoogleDriveImageSource implements ImageSource {
  private readonly rootFolderId: string;
  private readonly client: DriveClient;
  private readonly sharedDrive: boolean;
  private readonly reportBuilder: DriveScanReportBuilder;
  private readonly tempDir: string;

  constructor(config: GoogleDriveImageSourceConfig) {
    this.rootFolderId = config.rootFolderId;
    this.client = config.client;
    this.sharedDrive = config.sharedDrive ?? true;
    this.tempDir = config.tempDir ?? path.join(os.tmpdir(), "bppis-drive-import");

    // Reuse the existing discovery stack unchanged: FolderScanner walks the
    // tree, MimeImageFilter classifies, DepthBasedFolderMapper maps folders
    // to org units, DriveScanReportBuilder ties them together. Any of them
    // can be swapped via config, but the defaults are exactly the modules
    // Phase 9A already ships.
    const imageFilter = config.imageFilter ?? new MimeImageFilter();
    const folderScanner = config.folderScanner ?? new FolderScanner(this.client, imageFilter);
    const folderMapper = config.folderMapper ?? new DepthBasedFolderMapper({ rootFolderId: this.rootFolderId });
    this.reportBuilder =
      config.reportBuilder ?? new DriveScanReportBuilder({ folderScanner, folderMapper, imageFilter });
  }

  /**
   * Metadata-only discovery. Delegates to DriveScanReportBuilder (which
   * reuses FolderScanner/ImageFilter/FolderMapper), then adapts its entries
   * into the provider-agnostic DiscoveryResult. Downloads no file bytes.
   *
   * Region is taken from the resolved organizational unit; an image whose
   * folder maps to no region is reported as skipped (reason
   * "unmapped_region") rather than silently processed under an empty region,
   * mirroring how the filesystem source only yields images that live under a
   * region folder.
   */
  async discover(): Promise<DiscoveryResult> {
    const report = await this.reportBuilder.build(this.rootFolderId, { sharedDrive: this.sharedDrive });

    const images: DiscoveredImage[] = [];
    const skipped: SkippedFile[] = [];

    for (const entry of report.entries) {
      if (!entry.isImage) {
        skipped.push({
          file: entry.relativePath,
          region: entry.region ?? "",
          reason: "non_image",
        });
        continue;
      }

      if (!entry.region) {
        skipped.push({
          file: entry.relativePath,
          region: "",
          reason: "unmapped_region",
        });
        continue;
      }

      images.push(this.toDiscoveredImage(entry));
    }

    return { images, skipped };
  }

  /** Alias of `discover()` under the name the Phase 9C runner calls. Same result, no extra Drive traffic beyond the single scan. */
  async discoverImages(): Promise<DiscoveryResult> {
    return this.discover();
  }

  /**
   * Downloads exactly this one image's bytes to a unique temp file and
   * returns an OpenedImage whose `dispose()` deletes it. Only called by the
   * runner when it has decided to actually process the image (i.e. after
   * resume/skip checks), so no file is downloaded for an image that will be
   * skipped.
   */
  async openImage(image: DiscoveredImage): Promise<OpenedImage> {
    if (!image.sourceId) {
      // No provider id means the bytes must already be local (should not
      // happen for this source, but keeps the contract total).
      return openLocalImage(image.localPath);
    }

    if (typeof this.client.downloadFile !== "function") {
      throw new DriveProviderError(
        "The configured Drive client does not support downloading file bytes (downloadFile is not implemented)."
      );
    }

    const bytes = await this.client.downloadFile(image.sourceId);

    fs.mkdirSync(this.tempDir, { recursive: true });
    const tempPath = path.join(this.tempDir, `${randomUUID()}${path.extname(image.filename) || ".jpg"}`);
    fs.writeFileSync(tempPath, bytes);

    let disposed = false;
    return {
      localPath: tempPath,
      async dispose() {
        if (disposed) return;
        disposed = true;
        try {
          await fs.promises.rm(tempPath, { force: true });
        } catch {
          // Best-effort cleanup: a failed temp-file deletion must never
          // abort or fail the import of an image that otherwise succeeded.
        }
      },
    };
  }

  private toDiscoveredImage(entry: DriveScanEntry): DiscoveredImage {
    return {
      // Bytes are not local yet — the runner must call openImage() to
      // materialize them; localPath is intentionally empty until then.
      localPath: "",
      filename: entry.name,
      region: entry.region ?? "",
      sourceId: entry.id,
    };
  }
}
