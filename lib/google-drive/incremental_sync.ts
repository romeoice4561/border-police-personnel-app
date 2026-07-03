/**
 * IncrementalSync
 *
 * Orchestrates a single sync cycle for a folder: scan current files,
 * compute hashes, diff against the last SyncCheckpoint via ChangeDetector,
 * and produce a new checkpoint plus the set of new/modified/deleted files.
 *
 * This is the module a scheduled job (cron, webhook handler, or manual
 * trigger — none implemented in this phase) would call to keep the import
 * pipeline fed with only what has changed, rather than re-scanning
 * everything every time.
 */

import type { FolderScannerEngine } from "@/lib/google-drive/folder_scanner";
import type { ChangeDetectorEngine } from "@/lib/google-drive/change_detector";
import type { HashGenerator } from "@/lib/google-drive/hash_generator";
import type {
  DriveFileMetadata,
  IncrementalSyncResult,
  SyncCheckpoint,
} from "@/lib/google-drive/drive_types";

/** Contract for a checkpoint store. Allows swapping in a persisted store later. */
export interface SyncCheckpointStore {
  get(folderId: string): SyncCheckpoint | undefined;
  save(checkpoint: SyncCheckpoint): void;
}

/**
 * In-memory checkpoint store.
 *
 * Future extension point: persist checkpoints (e.g. Supabase) so sync state
 * survives process restarts.
 */
export class InMemorySyncCheckpointStore implements SyncCheckpointStore {
  private readonly checkpoints = new Map<string, SyncCheckpoint>();

  get(folderId: string): SyncCheckpoint | undefined {
    return this.checkpoints.get(folderId);
  }

  save(checkpoint: SyncCheckpoint): void {
    this.checkpoints.set(checkpoint.folderId, checkpoint);
  }
}

export interface IncrementalSyncDependencies {
  folderScanner: FolderScannerEngine;
  changeDetector: ChangeDetectorEngine;
  checkpointStore: SyncCheckpointStore;
  /**
   * Optional: computes content hashes for changed-file detection. Without
   * one supplied, hash-based comparison is skipped and only
   * presence/absence (new/deleted) is detected reliably — modifiedTime
   * could be used as a weaker proxy for "modified" in a future revision.
   */
  hashGenerator?: HashGenerator;
}

/**
 * Runs incremental sync cycles for a folder, tracking last scan time, new
 * files, modified files, and deleted files across calls.
 */
export class IncrementalSync {
  constructor(private readonly dependencies: IncrementalSyncDependencies) {}

  /**
   * Runs one sync cycle for the given folder id. On first run (no prior
   * checkpoint), all discovered files are reported as "new".
   */
  async sync(folderId: string): Promise<IncrementalSyncResult> {
    const { folderScanner, changeDetector, checkpointStore, hashGenerator } = this.dependencies;

    const previousCheckpoint = checkpointStore.get(folderId);
    const knownFileHashes = previousCheckpoint?.knownFileHashes ?? {};

    const currentFiles = await folderScanner.listImages(folderId);
    const currentHashesByFileId = await this.computeHashes(currentFiles, hashGenerator);

    const changes = changeDetector.detectChanges(currentFiles, knownFileHashes, currentHashesByFileId);

    const newFiles = changes.filter((c) => c.type === "new").map((c) => c.file);
    const modifiedFiles = changes.filter((c) => c.type === "modified").map((c) => c.file);
    const deletedFileIds = changes.filter((c) => c.type === "deleted").map((c) => c.file.id);

    const nextCheckpoint: SyncCheckpoint = {
      folderId,
      lastScannedAt: new Date().toISOString(),
      pageToken: previousCheckpoint?.pageToken,
      knownFileHashes: currentHashesByFileId,
    };

    checkpointStore.save(nextCheckpoint);

    return {
      checkpoint: nextCheckpoint,
      changes,
      newFiles,
      modifiedFiles,
      deletedFileIds,
    };
  }

  /**
   * Computes a hash per file id, if a HashGenerator is configured. Returns
   * an empty map otherwise, in which case ChangeDetector will only reliably
   * distinguish new/deleted, not modified.
   *
   * Future extension point: this phase has no file byte access, so a real
   * implementation must fetch file content (or rely on a provider-supplied
   * checksum, e.g. Drive's `md5Checksum`) before hashing is possible.
   */
  private async computeHashes(
    files: DriveFileMetadata[],
    hashGenerator?: HashGenerator
  ): Promise<Record<string, string>> {
    if (!hashGenerator) return {};

    const entries = await Promise.all(
      files.map(async (file) => [file.id, await hashGenerator.hash(new Uint8Array())] as const)
    );

    return Object.fromEntries(entries);
  }
}
