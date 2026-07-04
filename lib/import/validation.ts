/**
 * Import validation (Phase 17).
 *
 * Validates a parsed export file against the shape the engine requires and
 * resolves the deterministic `officerId`. It does NOT re-run the pipeline's
 * own Validation Engine or redesign the JSON — it only confirms the fields the
 * database import depends on are present and well-typed, and derives the
 * upsert key. Raises structured errors (ValidationError / ImageReferenceError)
 * so the caller records a precise cause.
 *
 * Pure: given a value, returns a ResolvedImportInput or throws. No I/O.
 */

import type { NormalizedPersonnelExtraction } from "@/lib/normalize/normalization_types";
import { ImageReferenceError, ValidationError, type PersonnelExportFile, type ResolvedImportInput } from "@/lib/import/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** basename without extension, matching the batch runner's officerId derivation. */
function baseName(fileName: string): string {
  const noPath = fileName.split(/[\\/]/).pop() ?? fileName;
  return noPath.replace(/\.[^.]+$/, "");
}

/**
 * Validates the structural shape of an export file and its
 * `normalized_extraction` (the record actually persisted). Collects every
 * issue and throws a single ValidationError listing them, so one bad file
 * reports all its problems at once rather than one at a time.
 */
export function validateExportFile(value: unknown): asserts value is PersonnelExportFile {
  const issues: string[] = [];

  if (!isObject(value)) {
    throw new ValidationError("Export file is not a JSON object.", ["root is not an object"]);
  }

  const extraction = value.normalized_extraction ?? value.original_extraction;
  if (!isObject(extraction)) {
    issues.push("missing normalized_extraction (and original_extraction) object");
  } else {
    for (const field of ["rank", "first_name", "last_name", "position"] as const) {
      if (typeof extraction[field] !== "string") {
        issues.push(`normalized_extraction.${field} must be a string`);
      }
    }
    if (extraction.timeline !== undefined && !Array.isArray(extraction.timeline)) {
      issues.push("normalized_extraction.timeline must be an array when present");
    } else if (Array.isArray(extraction.timeline)) {
      extraction.timeline.forEach((entry, index) => {
        if (!isObject(entry)) {
          issues.push(`normalized_extraction.timeline[${index}] must be an object`);
          return;
        }
        if (typeof entry.year !== "string" && entry.year !== null && entry.year !== undefined) {
          issues.push(`normalized_extraction.timeline[${index}].year must be a string`);
        }
        if (typeof entry.position !== "string" && entry.position !== null && entry.position !== undefined) {
          issues.push(`normalized_extraction.timeline[${index}].position must be a string`);
        }
      });
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(`Export file failed validation (${issues.length} issue(s)).`, issues);
  }
}

/**
 * Validates and resolves an export file into a ResolvedImportInput, deriving
 * the deterministic officerId. Precedence for the id:
 *   1. an explicit `source_id` on the file, else
 *   2. `${region}/${basename(source_file)}` (the batch runner's convention).
 * If neither yields a stable id, raises ImageReferenceError (the record can't
 * be safely upserted without a key — never guessed).
 */
export function resolveImportInput(value: unknown): ResolvedImportInput {
  validateExportFile(value);
  const file = value as PersonnelExportFile;

  const region = typeof file.region === "string" && file.region.trim().length > 0 ? file.region.trim() : null;
  const sourceFile =
    typeof file.source_file === "string" && file.source_file.trim().length > 0
      ? file.source_file.trim()
      : file.processing_metadata?.image ?? "";

  let officerId: string | null = null;
  if (typeof file.source_id === "string" && file.source_id.trim().length > 0) {
    officerId = file.source_id.trim();
  } else if (region && sourceFile) {
    officerId = `${region}/${baseName(sourceFile)}`;
  } else if (sourceFile) {
    officerId = baseName(sourceFile);
  }

  if (!officerId) {
    throw new ImageReferenceError(
      "Cannot derive a stable officerId: the export has no source_id, and no region/source_file to build one from. " +
        "Refusing to import without an idempotent key."
    );
  }

  return { officerId, region, sourceFile, file };
}

/** The canonical extraction the engine persists (normalized preferred, original as fallback). */
export function canonicalExtraction(file: PersonnelExportFile): NormalizedPersonnelExtraction {
  return (file.normalized_extraction ?? (file.original_extraction as NormalizedPersonnelExtraction));
}
