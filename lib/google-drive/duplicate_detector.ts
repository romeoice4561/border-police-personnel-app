/**
 * DuplicateDetector
 *
 * Groups files considered duplicates of one another, using (in order of
 * preference) SHA-256 hash, then filename, then filesize. Hash-based
 * matching is authoritative when hashes are available; filename/filesize
 * matching are weaker fallbacks used when hashes have not yet been computed
 * (e.g. before a HashGenerator has processed the file).
 */

import type { DriveFileMetadata, DuplicateGroup } from "@/lib/google-drive/drive_types";

/** Contract for duplicate detection. Allows swapping in a fuzzier/perceptual-hash strategy later. */
export interface DuplicateDetectorEngine {
  detectByHash(files: DriveFileMetadata[], hashesByFileId: Map<string, string>): DuplicateGroup[];
  detectByFilename(files: DriveFileMetadata[]): DuplicateGroup[];
  detectByFilesize(files: DriveFileMetadata[]): DuplicateGroup[];
}

/**
 * Groups files by a key extractor, choosing the earliest-modified file in
 * each group as canonical.
 */
function groupBy(
  files: DriveFileMetadata[],
  keyOf: (file: DriveFileMetadata) => string | undefined,
  matchedBy: DuplicateGroup["matchedBy"]
): DuplicateGroup[] {
  const groups = new Map<string, DriveFileMetadata[]>();

  for (const file of files) {
    const key = keyOf(file);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }

  const result: DuplicateGroup[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort(
      (a, b) => new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime()
    );
    const [canonical, ...duplicates] = sorted;

    result.push({ canonical, duplicates, matchedBy });
  }

  return result;
}

/**
 * Default duplicate detector implementing hash/filename/filesize
 * strategies. Future extension point: perceptual/near-duplicate image
 * hashing for visually-similar-but-not-byte-identical scans.
 */
export class DefaultDuplicateDetector implements DuplicateDetectorEngine {
  detectByHash(files: DriveFileMetadata[], hashesByFileId: Map<string, string>): DuplicateGroup[] {
    return groupBy(files, (file) => hashesByFileId.get(file.id), "hash");
  }

  detectByFilename(files: DriveFileMetadata[]): DuplicateGroup[] {
    return groupBy(files, (file) => file.name.trim().toLowerCase(), "filename");
  }

  detectByFilesize(files: DriveFileMetadata[]): DuplicateGroup[] {
    return groupBy(files, (file) => file.size, "filesize");
  }

  /**
   * Runs all strategies in priority order, returning hash-based groups
   * when hashes are available, otherwise falling back to filename, then
   * filesize.
   */
  detectAll(files: DriveFileMetadata[], hashesByFileId: Map<string, string>): DuplicateGroup[] {
    if (hashesByFileId.size > 0) {
      const hashGroups = this.detectByHash(files, hashesByFileId);
      if (hashGroups.length > 0) return hashGroups;
    }

    const filenameGroups = this.detectByFilename(files);
    if (filenameGroups.length > 0) return filenameGroups;

    return this.detectByFilesize(files);
  }
}
