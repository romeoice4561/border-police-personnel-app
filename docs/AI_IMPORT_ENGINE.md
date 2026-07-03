# AI Import Engine

Describes the pipeline that turns a personnel profile image into a validated
database record. Implementation lands in Phases 4-6.

## Import Pipeline

1. Image sourced from Google Drive sync (`lib/google-drive`).
2. Image preprocessing (`lib/ai`).
3. Vision extraction (`lib/ai`).
4. Confidence scoring per extracted field.
5. Parsing into internal data model (`lib/parser`).
6. Validation against Zod schemas (`lib/types`, `lib/parser`).
7. Manual review queue for low-confidence or failed records.
8. Database import into Supabase (`lib/database`).

## Image Preprocessing

- Normalize orientation and resolution before sending to the vision model.
- Strip identifying metadata (EXIF) not required downstream.
- Reject unreadable/corrupt files early and record the failure on `import_jobs`.

## Vision Extraction

- Single AI vision call per image, prompted to return structured JSON matching
  the target personnel schema.
- Provider-agnostic wrapper in `lib/ai` so the underlying model can be swapped.
- Raw model output is persisted alongside the parsed result for traceability.

## Confidence Score

- Every extracted field carries a confidence value from the vision model (or
  derived heuristically if the model doesn't provide one).
- A record-level confidence is computed as an aggregate (e.g. minimum or
  weighted average of required fields).
- Threshold-based routing: above threshold -> auto-import; below -> manual review.

## Manual Review

- Records below the confidence threshold, or failing validation, are queued
  rather than dropped.
- Reviewer sees the source image side-by-side with extracted fields and can
  accept, correct, or reject.
- Review decisions are recorded in `audit_logs`.

## Database Import

- Only validated records (auto-passed or reviewer-approved) are written to
  `officers` and related tables.
- Each import is tied to an `import_jobs` row for traceability from source
  image to final database record.
- Import is idempotent per source file (checksum-based duplicate detection,
  see `GOOGLE_DRIVE_SYNC.md`).
