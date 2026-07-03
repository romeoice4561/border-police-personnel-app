/**
 * Resume decision for the import runners.
 *
 * Extracts the resume rule shared by scripts/run_batch_import.ts and
 * scripts/run_drive_import.ts into one pure, independently-testable place so
 * the two runners cannot drift apart: an image is skipped (never
 * reprocessed, and — for the Drive runner — never even downloaded) when
 * either its export JSON already exists, or a classifier `.skipped.json`
 * marker already exists for it.
 *
 * Pure over an injected existence check (`exists`) so tests need no real
 * filesystem, and so callers keep using `fs.existsSync` unchanged.
 */

import path from "node:path";

/** Suffix of the marker written when the classifier decides an image should not reach OpenAI Vision. */
export const SKIPPED_MARKER_SUFFIX = ".skipped.json";

export type ResumeDecision =
  | { skip: false }
  | { skip: true; reason: "already_exported" | "classifier_skipped" };

export interface ResumePaths {
  /** Absolute path where this image's export JSON would be written. */
  exportPath: string;
  /** Absolute path of this image's classifier skip marker. */
  skipMarkerPath: string;
}

/** Computes the export + skip-marker paths for an image, given the exports root, its region, and filename. */
export function resumePathsFor(exportsDir: string, region: string, filename: string): ResumePaths {
  const baseName = path.basename(filename, path.extname(filename));
  return {
    exportPath: path.join(exportsDir, region, `${baseName}.json`),
    skipMarkerPath: path.join(exportsDir, region, `${baseName}${SKIPPED_MARKER_SUFFIX}`),
  };
}

/**
 * Decides whether an image should be skipped on resume. `exists` is injected
 * (normally `fs.existsSync`) so this stays pure and testable. The export
 * check takes priority over the classifier-marker check, matching the order
 * run_batch_import.ts already uses.
 */
export function resumeDecision(paths: ResumePaths, exists: (p: string) => boolean): ResumeDecision {
  if (exists(paths.exportPath)) {
    return { skip: true, reason: "already_exported" };
  }
  if (exists(paths.skipMarkerPath)) {
    return { skip: true, reason: "classifier_skipped" };
  }
  return { skip: false };
}
