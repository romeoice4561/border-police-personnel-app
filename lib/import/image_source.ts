/**
 * ImageSource
 *
 * Abstracts "where do batch-import images come from" behind a single
 * interface, so Phase 9A's filesystem-based discovery can be replaced by a
 * Phase 9B Google Drive-based discovery (see lib/google-drive/) without
 * changing anything in scripts/run_batch_import.ts downstream of
 * discovery: region detection, processing, output writing, resume support,
 * and reporting all operate on `DiscoveredImage`, not on filesystem paths
 * directly.
 */

import fs from "node:fs";
import path from "node:path";

/** File extensions this system will ever process as personnel profile images. */
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/** Files that are never personnel images, even though they may appear inside a region folder. */
const IGNORED_FILENAMES = new Set([".gitkeep", "thumbs.db", "desktop.ini"]);

/**
 * One image discovered by an ImageSource, with enough information for
 * downstream region detection, processing, and output naming — regardless
 * of whether it came from the filesystem or (in a future phase) Google
 * Drive.
 */
export interface DiscoveredImage {
  /** Absolute path to the local file. For a future Drive-backed source, this would be a downloaded/cached local copy. */
  localPath: string;
  /** Original filename, e.g. "officer001.jpg". */
  filename: string;
  /** Region identifier, e.g. "ภาค1" — derived from the immediate parent folder in this phase. */
  region: string;
}

/** A file encountered during discovery that was not treated as a processable image, and why. */
export interface SkippedFile {
  file: string;
  region: string;
  reason: string;
}

export interface DiscoveryResult {
  images: DiscoveredImage[];
  skipped: SkippedFile[];
}

/**
 * Contract every image source must implement. `discover()` returns every
 * processable image plus a record of anything skipped, up front — this
 * phase processes sequentially, but returning the full list (rather than
 * an async iterator) keeps this interface simple; a future phase needing
 * to stream tens of thousands of Drive files could extend this without
 * breaking existing callers, since they'd still receive the same
 * DiscoveryResult shape at the end.
 */
export interface ImageSource {
  discover(): Promise<DiscoveryResult>;
}

function isSupportedImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function isIgnoredFile(filename: string): boolean {
  return IGNORED_FILENAMES.has(filename.toLowerCase());
}

/**
 * Discovers images from a local directory tree, one subfolder per region
 * (e.g. `imports/ภาค1/`, `imports/ภาค2/`). The region is the immediate
 * child folder name directly under `rootDir` — this phase does not
 * recurse into further nested subfolders beyond that one level, matching
 * the documented `imports/<region>/*.jpg` structure.
 *
 * Future extension point (Phase 9B): implement `ImageSource` with a
 * `GoogleDriveImageSource` that lists files via lib/google-drive's
 * `FolderScanner`/`FolderMapper` instead of `fs.readdirSync`, producing the
 * same `DiscoveredImage[]` shape (region resolved via `FolderMapper`
 * instead of a directory name) — no changes required anywhere downstream.
 */
export class FilesystemImageSource implements ImageSource {
  constructor(private readonly rootDir: string) {}

  async discover(): Promise<DiscoveryResult> {
    const images: DiscoveredImage[] = [];
    const skipped: SkippedFile[] = [];

    if (!fs.existsSync(this.rootDir)) {
      return { images, skipped };
    }

    const regionEntries = fs
      .readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const regionEntry of regionEntries) {
      const region = regionEntry.name;
      const regionDir = path.join(this.rootDir, region);

      const fileEntries = fs
        .readdirSync(regionDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const fileEntry of fileEntries) {
        const filename = fileEntry.name;

        if (isIgnoredFile(filename)) {
          continue; // system/OS artifacts are not reported as skipped — they were never candidate images
        }

        if (!isSupportedImageFile(filename)) {
          skipped.push({ file: filename, region, reason: "unsupported_extension" });
          continue;
        }

        images.push({
          localPath: path.join(regionDir, filename),
          filename,
          region,
        });
      }
    }

    return { images, skipped };
  }
}
