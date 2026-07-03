/**
 * DriveScanReport
 *
 * Walks the tree produced by the existing `FolderScanner.scanRecursive()`
 * (no rewrite of that module — this is a pure consumer of its output),
 * classifies each file as image/non-image via the existing
 * `ImageFilterEngine`, resolves each file's organizational unit via an
 * injected `FolderMapperEngine`, and produces:
 *   - a flat `DriveScanEntry[]` (one entry per discovered file, matching
 *     the required output shape), and
 *   - a `DriveScanSummary` aggregate for logs/drive_summary.json.
 *
 * Metadata-only: this module never downloads file bytes and never calls
 * files.create/update/delete anywhere in its own code or in anything it
 * depends on (FolderScanner/FileScanner/ImageFilter/FolderMapper are all
 * pre-existing, read-only, reused unchanged).
 */

import type { DriveFolder } from "@/lib/google-drive/drive_types";
import type { FolderScanResult, FolderScannerEngine } from "@/lib/google-drive/folder_scanner";
import type { ImageFilterEngine } from "@/lib/google-drive/image_filter";
import { MimeImageFilter } from "@/lib/google-drive/image_filter";
import type { FolderMapperEngine } from "@/lib/google-drive/folder_mapper";

/** One discovered file, with full metadata and resolved organizational placement — the required per-file output shape. */
export interface DriveScanEntry {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime?: string;
  modifiedTime: string;
  md5Checksum?: string;
  parentFolder: string;
  region?: string;
  province?: string;
  battalion?: string;
  company?: string;
  relativePath: string;
  isImage: boolean;
}

export interface DriveScanSummary {
  root_folder: string;
  total_folders: number;
  total_files: number;
  image_files: number;
  non_image_files: number;
  regions: string[];
  scan_duration_ms: number;
  shared_drive: boolean;
}

export interface DriveScanReport {
  entries: DriveScanEntry[];
  summary: DriveScanSummary;
}

export interface DriveScanReportBuilderDependencies {
  folderScanner: FolderScannerEngine;
  folderMapper: FolderMapperEngine;
  imageFilter?: ImageFilterEngine;
}

/**
 * Builds a full DriveScanReport for a root folder by walking the
 * FolderScanner tree once, tallying folders/files, resolving each file's
 * DriveScanEntry, and (via the injected FolderMapperEngine) its
 * organizational unit.
 */
export class DriveScanReportBuilder {
  private readonly folderScanner: FolderScannerEngine;
  private readonly folderMapper: FolderMapperEngine;
  private readonly imageFilter: ImageFilterEngine;

  constructor(dependencies: DriveScanReportBuilderDependencies) {
    this.folderScanner = dependencies.folderScanner;
    this.folderMapper = dependencies.folderMapper;
    this.imageFilter = dependencies.imageFilter ?? new MimeImageFilter();
  }

  async build(rootFolderId: string, options: { sharedDrive: boolean }): Promise<DriveScanReport> {
    const startedAt = Date.now();

    const tree = await this.folderScanner.scanRecursive(rootFolderId);

    const entries: DriveScanEntry[] = [];
    let totalFolders = 0;
    const regions = new Set<string>();

    this.walk(tree, [tree.folder], "", entries, regions, () => {
      totalFolders += 1;
    });

    const imageCount = entries.filter((entry) => entry.isImage).length;

    const summary: DriveScanSummary = {
      root_folder: rootFolderId,
      total_folders: totalFolders,
      total_files: entries.length,
      image_files: imageCount,
      non_image_files: entries.length - imageCount,
      regions: Array.from(regions).sort(),
      scan_duration_ms: Date.now() - startedAt,
      shared_drive: options.sharedDrive,
    };

    return { entries, summary };
  }

  private walk(
    node: FolderScanResult,
    folderChain: DriveFolder[],
    relativePathPrefix: string,
    entries: DriveScanEntry[],
    regions: Set<string>,
    onFolder: () => void
  ): void {
    onFolder();

    const { accepted: images } = this.imageFilter.filter(node.files);
    const imageIds = new Set(images.map((file) => file.id));

    const unit = this.folderMapper.mapFolderChain(folderChain);
    if (unit?.region) regions.add(unit.region);

    for (const file of node.files) {
      const relativePath = relativePathPrefix ? `${relativePathPrefix}/${file.name}` : file.name;

      entries.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        md5Checksum: file.md5Checksum,
        parentFolder: node.folder.id,
        region: unit?.region,
        province: unit?.province,
        battalion: unit?.battalion,
        company: unit?.company,
        relativePath,
        isImage: imageIds.has(file.id),
      });
    }

    for (const subfolder of node.subfolders) {
      const subPath = relativePathPrefix ? `${relativePathPrefix}/${subfolder.folder.name}` : subfolder.folder.name;
      this.walk(subfolder, [...folderChain, subfolder.folder], subPath, entries, regions, onFolder);
    }
  }
}
