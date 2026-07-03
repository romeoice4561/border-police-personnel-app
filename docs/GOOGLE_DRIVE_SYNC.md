# Google Drive Sync

Describes how personnel profile images are sourced from Google Drive.
Implementation lands in Phase 3.

## Google Drive API

- Service account with read-only (or restricted) access to designated shared
  folders — never broader account access.
- Client wrapper lives in `lib/google-drive`, isolated from the rest of the
  app so the source system could be swapped later.
- All API calls rate-limited and retried with backoff; failures logged to
  `import_jobs`.

## Folder Scanning

- Configurable root folder(s) to scan, recursively if needed.
- Each scan enumerates image files with metadata (file ID, name, modified
  time, checksum/hash if available).
- Scan results are diffed against previously known files before triggering
  any AI processing.

## Duplicate Detection

- Primary key for dedup: Drive file ID.
- Secondary check: content checksum, to catch re-uploaded copies of the same
  image under a different file ID.
- Duplicate files are recorded but not reprocessed unless forced.

## Incremental Import

- Sync tracks the last successful scan timestamp/token per folder.
- Subsequent scans only process files new or modified since that checkpoint.
- Full re-scan is a manual/administrative operation, not the default path.
- Every incremental sync run creates an `import_jobs` entry summarizing files
  found, skipped (duplicate), and queued for processing.
