/**
 * Unit tests for GoogleDriveImageSource (Phase 9C), using a fake DriveClient
 * only — no real Google credentials or network calls. Verifies:
 *   - discovery adapts the reused scan report into DiscoveredImage[]
 *   - region resolved via the reused DepthBasedFolderMapper
 *   - non-image / unmapped files are reported as skipped, not processed
 *   - openImage downloads exactly one file, exactly once, to a temp file
 *   - dispose() deletes the temp file (and is idempotent)
 *   - a download failure surfaces without downloading anything else
 *
 * Run with:
 *   npx tsx --test lib/google-drive/__tests__/google_drive_image_source.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { DriveClient, ListFolderPage } from "@/lib/google-drive/drive_client";
import type { DriveFileMetadata, DriveFolder } from "@/lib/google-drive/drive_types";
import { GoogleDriveImageSource } from "@/lib/google-drive/google_drive_image_source";

/**
 * A fake read-only DriveClient over a small in-memory tree that also records
 * every downloadFile() call, so tests can assert exactly one download per
 * opened image and that no bytes are fetched during discovery.
 *
 *   ROOT
 *     ภาค1 (REGION1)
 *       officer1.jpg (image), notes.pdf (non-image)
 *       บก.1 (PROVINCE1)
 *         officer2.png (image)
 */
class FakeDriveClient implements DriveClient {
  readonly downloadedIds: string[] = [];

  private readonly folders = new Map<string, DriveFolder>([
    ["ROOT", { id: "ROOT", name: "root", parents: [] }],
    ["REGION1", { id: "REGION1", name: "ภาค1", parents: ["ROOT"] }],
    ["PROVINCE1", { id: "PROVINCE1", name: "บก.1", parents: ["REGION1"] }],
  ]);

  private readonly subfolders = new Map<string, DriveFolder[]>([
    ["ROOT", [this.folderRef("REGION1")]],
    ["REGION1", [this.folderRef("PROVINCE1")]],
  ]);

  private readonly filesByFolder = new Map<string, DriveFileMetadata[]>([
    [
      "REGION1",
      [
        {
          id: "f-officer1",
          name: "officer1.jpg",
          mimeType: "image/jpeg",
          size: "1024",
          modifiedTime: "2026-01-01T00:00:00Z",
          parents: ["REGION1"],
        },
        {
          id: "f-notes",
          name: "notes.pdf",
          mimeType: "application/pdf",
          size: "2048",
          modifiedTime: "2026-01-02T00:00:00Z",
          parents: ["REGION1"],
        },
      ],
    ],
    [
      "PROVINCE1",
      [
        {
          id: "f-officer2",
          name: "officer2.png",
          mimeType: "image/png",
          size: "512",
          modifiedTime: "2026-01-03T00:00:00Z",
          parents: ["PROVINCE1"],
        },
      ],
    ],
  ]);

  private folderRef(id: string): DriveFolder {
    return this.folders.get(id)!;
  }

  async getFolder(folderId: string): Promise<DriveFolder> {
    const folder = this.folders.get(folderId);
    if (!folder) throw new Error(`Unknown folder ${folderId}`);
    return folder;
  }

  async listFolderChildren(folderId: string): Promise<ListFolderPage> {
    return {
      files: this.filesByFolder.get(folderId) ?? [],
      subfolders: this.subfolders.get(folderId) ?? [],
      nextPageToken: undefined,
    };
  }

  async getFile(fileId: string): Promise<DriveFileMetadata> {
    for (const files of this.filesByFolder.values()) {
      const match = files.find((f) => f.id === fileId);
      if (match) return match;
    }
    throw new Error(`Unknown file ${fileId}`);
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    this.downloadedIds.push(fileId);
    return Buffer.from(`bytes-of-${fileId}`);
  }
}

function makeSource(client: DriveClient, tempDir: string) {
  return new GoogleDriveImageSource({ rootFolderId: "ROOT", client, sharedDrive: false, tempDir });
}

function freshTempDir(): string {
  return path.join(os.tmpdir(), `bppis-drive-image-source-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

test("discover() finds only image files and resolves their region, downloading nothing", async () => {
  const client = new FakeDriveClient();
  const source = makeSource(client, freshTempDir());

  const { images, skipped } = await source.discover();

  const names = images.map((i) => i.filename).sort();
  assert.deepEqual(names, ["officer1.jpg", "officer2.png"]);

  const officer1 = images.find((i) => i.filename === "officer1.jpg")!;
  assert.equal(officer1.region, "ภาค1");
  assert.equal(officer1.sourceId, "f-officer1");

  const officer2 = images.find((i) => i.filename === "officer2.png")!;
  assert.equal(officer2.region, "ภาค1"); // one level under root is the region, per DepthBasedFolderMapper

  // The pdf is reported as skipped, not silently dropped or processed.
  assert.ok(skipped.some((s) => s.reason === "non_image"));

  // Discovery is metadata-only: no bytes downloaded.
  assert.equal(client.downloadedIds.length, 0);
});

test("discoverImages() is an alias of discover()", async () => {
  const client = new FakeDriveClient();
  const source = makeSource(client, freshTempDir());

  const viaDiscover = await source.discover();
  const viaAlias = await source.discoverImages();

  assert.deepEqual(
    viaAlias.images.map((i) => i.sourceId).sort(),
    viaDiscover.images.map((i) => i.sourceId).sort()
  );
});

test("openImage() downloads exactly one file to a temp path, and dispose() deletes it", async () => {
  const client = new FakeDriveClient();
  const tempDir = freshTempDir();
  const source = makeSource(client, tempDir);

  const { images } = await source.discover();
  const image = images.find((i) => i.filename === "officer1.jpg")!;

  const opened = await source.openImage(image);

  // Exactly one download, for exactly this image's id.
  assert.deepEqual(client.downloadedIds, ["f-officer1"]);

  // Temp file exists, lives under the configured temp dir, and holds the bytes.
  assert.ok(fs.existsSync(opened.localPath));
  assert.ok(opened.localPath.startsWith(tempDir));
  assert.equal(fs.readFileSync(opened.localPath, "utf-8"), "bytes-of-f-officer1");
  assert.equal(path.extname(opened.localPath), ".jpg");

  await opened.dispose();
  assert.equal(fs.existsSync(opened.localPath), false);

  // dispose() is idempotent.
  await opened.dispose();
  assert.equal(fs.existsSync(opened.localPath), false);
});

test("openImage() does not download during discovery; each image is fetched only when opened", async () => {
  const client = new FakeDriveClient();
  const source = makeSource(client, freshTempDir());

  const { images } = await source.discover();
  assert.equal(client.downloadedIds.length, 0);

  const opened1 = await source.openImage(images[0]);
  assert.equal(client.downloadedIds.length, 1);
  await opened1.dispose();

  const opened2 = await source.openImage(images[1]);
  assert.equal(client.downloadedIds.length, 2);
  await opened2.dispose();
});

test("openImage() surfaces a download failure as an error (import runner turns this into a per-image failure)", async () => {
  class FailingClient extends FakeDriveClient {
    override async downloadFile(): Promise<Buffer> {
      throw new Error("permission denied (403)");
    }
  }

  const client = new FailingClient();
  const source = makeSource(client, freshTempDir());
  const { images } = await source.discover();

  await assert.rejects(() => source.openImage(images[0]), /permission denied/);
});
