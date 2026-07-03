# Sync Strategy

Companion to `docs/GOOGLE_DRIVE_ARCHITECTURE.md`, focused specifically on
how the system keeps its view of Drive folders up to date over time.

## Sync Modes

1. **Full scan** — `FolderScanner.scanRecursive` / `listImages` walks the
   entire folder tree from scratch. Used for the first sync of a folder, or
   an administrative "force re-scan."
2. **Incremental sync** — `IncrementalSync.sync(folderId)` compares a fresh
   listing against the last `SyncCheckpoint` and reports only what changed.
   Used for all regular/scheduled syncs once a folder has an initial
   checkpoint.

## Checkpoint Model

A `SyncCheckpoint` records, per folder:
- `lastScannedAt` — when this checkpoint was produced.
- `pageToken` — a provider-native change token, if the provider supports
  one (Drive's `changes.getStartPageToken`), for future use by a
  webhook/change-feed-based sync instead of full-listing comparison.
- `knownFileHashes` — a map of file id to content hash, as of this
  checkpoint. This is what `ChangeDetector` diffs the next scan against.

Checkpoints are stored via `SyncCheckpointStore` (in-memory in this phase);
a future phase can back this with Supabase so sync state survives process
restarts and is shared across worker instances.

## Change Classification

Given the current file listing and a checkpoint's `knownFileHashes`,
`ChangeDetector.detectChanges` classifies every file id it has seen
(current or previously known) as exactly one of:

| Type | Condition |
|---|---|
| `new` | File id not present in `knownFileHashes` |
| `modified` | File id present, but current hash differs from known hash |
| `unchanged` | File id present, hash matches (or no hash available and file still present) |
| `deleted` | File id present in `knownFileHashes` but absent from the current listing |

## Hashing Dependency

Reliable `modified` detection requires a `HashGenerator` capable of
producing a real content hash — this phase ships only a stub
(`StubSha256HashGenerator`) since no file bytes are downloaded yet. Without
a working hash generator, `IncrementalSync` still correctly detects `new`
and `deleted` files (presence/absence), but cannot distinguish "unchanged"
from "modified" — a future phase should either:
- implement real SHA-256 hashing over downloaded file bytes, or
- use the Drive API's `md5Checksum` field (mapped through
  `StubMd5HashGenerator`) as a cheaper proxy that avoids downloading full
  file content just to detect changes.

## Recommended Sync Cadence (future operational guidance)

Not implemented in this phase (no scheduler wiring to Drive exists yet),
but the intended usage pattern once real credentials and a scheduler are in
place:
- Run `IncrementalSync.sync(folderId)` on a fixed interval per configured
  region root folder.
- Feed `newFiles` and `modifiedFiles` from the result into
  `BatchProcessor.processAll` (via `toImportScannedImage`, see
  `scan_result.ts`) so only changed images re-enter the import pipeline.
- Treat `deletedFileIds` as a signal for a future review/archival workflow
  — this phase does not define what happens to already-imported records
  for a deleted source file (no database exists yet to update).

## Duplicate Detection vs. Change Detection

These are deliberately separate concerns:
- **Change detection** answers "has this specific file (by id) changed
  since last sync."
- **Duplicate detection** answers "do two different files (possibly
  different ids, possibly in different folders) represent the same
  underlying image."

A file can be simultaneously "unchanged" (same id, same hash as last sync)
and "a duplicate" (its hash matches a different file's hash too). Both
checks should run; `DuplicateDetector` operates on whatever file set is
being processed (e.g. the `newFiles` from an incremental sync, or a full
scan) independently of `ChangeDetector`'s per-id comparison.
