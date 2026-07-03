/**
 * ChangeDetector
 *
 * Compares a fresh listing of files against a previously known set (from a
 * SyncCheckpoint) and classifies each as new, modified, deleted, or
 * unchanged. Pure comparison logic — no network access; IncrementalSync
 * composes this with a FolderScanner and a HashGenerator to run a full
 * sync cycle.
 */

import type { DriveFileMetadata, FileChange } from "@/lib/google-drive/drive_types";

/** Contract for change detection. Allows swapping in a provider-native change-feed strategy later. */
export interface ChangeDetectorEngine {
  detectChanges(
    currentFiles: DriveFileMetadata[],
    knownFileHashes: Record<string, string>,
    currentHashesByFileId: Record<string, string>
  ): FileChange[];
}

/**
 * Hash-comparison-based change detector.
 *
 * Future extension point: for providers exposing a native change feed
 * (e.g. Drive API's `changes.list`), a future implementation could consume
 * that feed directly instead of diffing two full snapshots, which scales
 * better for very large folder trees.
 */
export class DefaultChangeDetector implements ChangeDetectorEngine {
  detectChanges(
    currentFiles: DriveFileMetadata[],
    knownFileHashes: Record<string, string>,
    currentHashesByFileId: Record<string, string>
  ): FileChange[] {
    const changes: FileChange[] = [];
    const seenIds = new Set<string>();

    for (const file of currentFiles) {
      seenIds.add(file.id);
      const previousHash = knownFileHashes[file.id];
      const currentHash = currentHashesByFileId[file.id];

      if (previousHash === undefined) {
        changes.push({ type: "new", file, currentHash });
      } else if (currentHash !== undefined && currentHash !== previousHash) {
        changes.push({ type: "modified", file, previousHash, currentHash });
      } else {
        changes.push({ type: "unchanged", file, previousHash, currentHash });
      }
    }

    for (const [fileId, previousHash] of Object.entries(knownFileHashes)) {
      if (!seenIds.has(fileId)) {
        changes.push({
          type: "deleted",
          file: { id: fileId, name: "", mimeType: "", size: "0", modifiedTime: "", parents: [] },
          previousHash,
        });
      }
    }

    return changes;
  }
}
