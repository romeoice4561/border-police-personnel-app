/**
 * Production Import Engine — shared types and structured errors (Phase 17).
 *
 * The engine imports the OCR pipeline's own output — a `PersonnelResult`
 * wrapped in the export envelope the batch runner writes (`{ source_file,
 * region, ...PersonnelResult }`) — into the relational database, idempotently.
 * It does NOT redesign the JSON, modify OCR/extraction, or change the schema:
 * it maps the existing `normalized_extraction` onto the existing Prisma models
 * via the existing repositories.
 *
 * Pure domain typing + error classes. No I/O, no Prisma import here.
 */

import type { PersonnelResult } from "@/lib/import/personnel_image_processor";

/**
 * The on-disk export envelope produced by the batch runner for one image.
 * It is a `PersonnelResult` plus the provenance the runner adds (`source_file`,
 * `region`), which the import engine needs to derive the stable `officerId`.
 * All pipeline fields are preserved; the engine only reads what it persists.
 */
export interface PersonnelExportFile extends PersonnelResult {
  /** Original image filename, e.g. "5.jpg". */
  source_file?: string;
  /** Region folder the image came from, e.g. "ภาค1". */
  region?: string;
  /**
   * The Google Drive file id of the image that produced this record, when the
   * export came from a Drive import. This is the photo identity Phase 17B
   * preserves — reused as-is, never re-fetched. Absent for filesystem imports.
   */
  source_id?: string;
  /** Captured provider thumbnail link, when the Drive metadata carried one. */
  thumbnail_link?: string;
  /** Captured provider web-view link, when the Drive metadata carried one. */
  web_view_link?: string;
  processing_timestamp?: string;
}

/** The identity + payload the engine persists for one officer, derived from an export file. */
export interface ResolvedImportInput {
  /** Deterministic upsert key: `${region}/${basename(source_file)}` (or an explicit source_id). */
  officerId: string;
  region: string | null;
  sourceFile: string;
  file: PersonnelExportFile;
}

/** Per-officer outcome of a single import, for the summary + logs. */
export interface OfficerImportResult {
  officerId: string;
  action: "created" | "updated" | "failed";
  timelines: number;
  phones: number;
  unitsCreated: number;
  error?: string;
}

/** Aggregate summary of an import run (also written to logs/database_import_summary.json). */
export interface ImportRunSummary {
  jobId: number;
  total: number;
  officers_created: number;
  officers_updated: number;
  timelines_written: number;
  phones_written: number;
  units_created: number;
  failed: number;
  elapsed_ms: number;
}

// ---------------------------------------------------------------------------
// Structured errors — every failure the engine raises is one of these, so the
// runner and ImportLog can record a precise cause rather than a bare string.
// ---------------------------------------------------------------------------

/** Base class so callers can `instanceof ImportError` to catch any engine error. */
export class ImportError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ImportError";
  }
}

/** The input JSON is missing/malformed/absent required fields. Raised before any DB write. */
export class ValidationError extends ImportError {
  constructor(message: string, public readonly issues: string[] = []) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A database operation failed (connection, constraint, query). Wraps the underlying driver error. */
export class DatabaseError extends ImportError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "DatabaseError";
  }
}

/**
 * The import would conflict with existing data in a way the engine refuses to
 * resolve silently (e.g. two different source files resolving to the same
 * officerId within one run). Not thrown for the normal "already exists →
 * update" path, which is expected and idempotent.
 */
export class ImportConflictError extends ImportError {
  constructor(message: string, public readonly officerId?: string) {
    super(message);
    this.name = "ImportConflictError";
  }
}

/** The export references a source image that cannot be identified (no source_file/region → no stable id). */
export class ImageReferenceError extends ImportError {
  constructor(message: string) {
    super(message);
    this.name = "ImageReferenceError";
  }
}
