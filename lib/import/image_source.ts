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
import type { DriveContentType } from "@/lib/google-drive/drive_content_type";

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
  /**
   * Absolute path to the local file, when the source has the bytes locally
   * available at discovery time (the filesystem source). A remote source
   * that downloads lazily (Phase 9C's Google Drive source) leaves this empty
   * and instead provides the bytes on demand via `ImageSource.openImage()`;
   * callers that support lazy sources must use `openImage()` rather than
   * reading `localPath` directly.
   */
  localPath: string;
  /** Original filename, e.g. "officer001.jpg". */
  filename: string;
  /** Region identifier, e.g. "ภาค1" — derived from the immediate parent folder / folder mapping. */
  region: string;
  /**
   * Stable provider id for the underlying file, when the source has one
   * (e.g. a Google Drive file id). Undefined for the filesystem source.
   * Used by remote sources to fetch bytes in `openImage()`.
   */
  sourceId?: string;
  /**
   * Phase 18B: the semantic content type of the top-level Drive folder this
   * image came from (PROFILE / NEIGHBOR_MAP / … / UNKNOWN). Discovery metadata
   * that lets a runner route only PROFILE images into OCR/OpenAI and treat the
   * rest as Gallery content. Optional — the filesystem source leaves it unset.
   */
  contentType?: DriveContentType;
}

/**
 * A single image whose bytes have been made available on the local
 * filesystem for processing, plus a `dispose()` that releases any temporary
 * resource created to do so. For the filesystem source this simply points
 * at the already-local file and `dispose()` is a no-op; for a lazily
 * downloading source (Google Drive) `localPath` is a temp file that
 * `dispose()` deletes.
 */
export interface OpenedImage {
  localPath: string;
  /** Releases any temporary local copy created by `openImage()`. Idempotent; never throws. */
  dispose(): Promise<void>;
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
 *
 * `discoverImages()` and `openImage()` are the Phase 9C additions that let a
 * source hold its bytes remotely and materialize them one at a time:
 *   - `discoverImages()` is a thin alias of `discover()` under the name the
 *     Phase 9C runner uses; both return the same DiscoveryResult, so either
 *     name works and existing callers of `discover()` are unaffected.
 *   - `openImage(image)` downloads/prepares exactly the one image's bytes on
 *     the local filesystem and returns an `OpenedImage` whose `dispose()`
 *     cleans up any temp copy. Sources that always have local bytes need not
 *     implement it — the provided default `openImageFrom()` helper simply
 *     wraps the existing `localPath` with a no-op `dispose()`.
 */
export interface ImageSource {
  discover(): Promise<DiscoveryResult>;
  /** Alias of `discover()` for the Phase 9C runner. Optional; defaults to `discover()`. */
  discoverImages?(): Promise<DiscoveryResult>;
  /** Materializes one image's bytes locally for processing. Optional; sources with local bytes can rely on `localPath`. */
  openImage?(image: DiscoveredImage): Promise<OpenedImage>;
}

/**
 * Default `openImage` behaviour for sources whose bytes are already local:
 * hand back the existing `localPath` with a no-op `dispose()`. Extracted as
 * a shared helper so both `FilesystemImageSource` and the Phase 9C runner's
 * fallback path use identical semantics rather than re-implementing them.
 */
export function openLocalImage(localPath: string): OpenedImage {
  return {
    localPath,
    async dispose() {
      /* no temp copy was created; nothing to clean up */
    },
  };
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

  /** Alias of `discover()`; the filesystem source has no separate lazy path. */
  async discoverImages(): Promise<DiscoveryResult> {
    return this.discover();
  }

  /** Filesystem bytes are already local — hand back the existing path with a no-op cleanup. */
  async openImage(image: DiscoveredImage): Promise<OpenedImage> {
    return openLocalImage(image.localPath);
  }

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
