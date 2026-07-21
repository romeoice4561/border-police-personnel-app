/**
 * Phase 49A.3A — Gallery preview download helpers + proxy handler.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  asciiFallbackDownloadFilename,
  extensionFromPath,
  galleryAssetDownloadApiPath,
  galleryAssetDownloadFilename,
  galleryAssetUpstreamImageUrls,
  mimeTypeFromExtension,
} from "@/lib/gallery/gallery_download";
import { handleDownloadGalleryAsset } from "@/lib/gallery/gallery_api_handlers";
import { InMemoryAssetRepository } from "@/lib/gallery/asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
import { AssetCategory } from "@/lib/gallery/asset_category";
import type { Asset } from "@/lib/gallery/asset_types";
import { toDownloadName } from "@/lib/ui/download_file";

function asset(partial: Partial<Asset> & { assetId: string }): Asset {
  return {
    category: AssetCategory.CompanyLocation,
    region: "ตชด.ภาค 4",
    company: "ตชด.414",
    battalion: null,
    folderName: "แผนที่ตั้งกองร้อย",
    relativePath: `แผนที่ตั้งกองร้อย/ตชด.414/${partial.assetId}.jpg`,
    driveFileId: partial.assetId,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${partial.assetId}&sz=w256`,
    webViewUrl: `https://drive.google.com/file/d/${partial.assetId}/view`,
    createdTime: null,
    updatedTime: null,
    verified: false,
    ...partial,
  };
}

test("extensionFromPath / mimeTypeFromExtension cover jpg png pdf", () => {
  assert.equal(extensionFromPath("a/b/photo.JPG"), "jpg");
  assert.equal(extensionFromPath("map.png"), "png");
  assert.equal(extensionFromPath("doc.pdf"), "pdf");
  assert.equal(extensionFromPath("noext"), "jpg");
  assert.equal(mimeTypeFromExtension("jpg"), "image/jpeg");
  assert.equal(mimeTypeFromExtension("png"), "image/png");
  assert.equal(mimeTypeFromExtension("pdf"), "application/pdf");
});

test("galleryAssetDownloadFilename preserves original leaf name + extension", () => {
  assert.equal(
    galleryAssetDownloadFilename(
      asset({
        assetId: "id1",
        relativePath: "แผนที่ตั้งกองร้อย/ตชด.414/ตชด.414_แผนที่กองร้อย_3013568.jpg",
      })
    ),
    toDownloadName("ตชด.414_แผนที่กองร้อย_3013568", { ext: "jpg" })
  );
  assert.equal(
    galleryAssetDownloadFilename(
      asset({ assetId: "id2", relativePath: "maps/unit.png", folderName: "ignored" })
    ),
    toDownloadName("unit", { ext: "png" })
  );
  assert.equal(
    galleryAssetDownloadFilename(
      asset({ assetId: "id3", relativePath: "docs/brief.pdf", folderName: "x" })
    ),
    toDownloadName("brief", { ext: "pdf" })
  );
});

test("galleryAssetDownloadFilename falls back when path has no leaf extension", () => {
  const name = galleryAssetDownloadFilename({
    assetId: "abc",
    relativePath: "folder/",
    folderName: "แผนที่หน่วยข้างเคียง",
  });
  assert.equal(name, toDownloadName("แผนที่หน่วยข้างเคียง", { ext: "jpg" }));
});

test("missing filename / empty stem still yields a usable download name", () => {
  const name = galleryAssetDownloadFilename({
    assetId: "only-id",
    relativePath: "",
    folderName: null,
  });
  assert.equal(name, "only-id.jpg");
});

test("asciiFallbackDownloadFilename for Thai names", () => {
  assert.equal(asciiFallbackDownloadFilename("แผนที่.jpg", "image/jpeg"), "gallery-asset.jpeg");
  assert.equal(asciiFallbackDownloadFilename("map-414.jpg", "image/jpeg"), "map-414.jpg");
});

test("galleryAssetUpstreamImageUrls never returns webView HTML page", () => {
  const urls = galleryAssetUpstreamImageUrls(
    asset({
      assetId: "FILE1",
      driveFileId: "FILE1",
      thumbnailUrl: "https://drive.google.com/thumbnail?id=FILE1&sz=w256",
      webViewUrl: "https://drive.google.com/file/d/FILE1/view",
    })
  );
  assert.ok(urls.length >= 1);
  assert.ok(urls[0]?.includes("sz=w2048") || urls[0]?.includes("thumbnail"));
  assert.ok(urls.every((u) => !u.includes("/view")));
});

test("galleryAssetDownloadApiPath is same-origin API path", () => {
  assert.equal(
    galleryAssetDownloadApiPath("1Nvx9yt_01g1Vfkrh6yvSJOZb6-Cf7MWJ"),
    "/api/gallery/assets/1Nvx9yt_01g1Vfkrh6yvSJOZb6-Cf7MWJ/download"
  );
});

test("handleDownloadGalleryAsset proxies bytes with Content-Disposition attachment", async () => {
  const originalFetch = globalThis.fetch;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // minimal jpeg-ish
  globalThis.fetch = (async () =>
    new Response(bytes, { status: 200, headers: { "Content-Type": "image/jpeg" } })) as typeof fetch;

  try {
    const svc = new AssetService({
      repository: new InMemoryAssetRepository([
        asset({
          assetId: "dl-1",
          relativePath: "แผนที่ตั้งกองร้อย/ตชด.414/unit-map.jpg",
        }),
      ]),
    });
    const res = await handleDownloadGalleryAsset(svc, "dl-1");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/jpeg");
    const cd = res.headers.get("Content-Disposition") ?? "";
    assert.match(cd, /attachment/);
    assert.match(cd, /filename\*=UTF-8''/);
    assert.match(cd, /unit-map\.jpg/);
    const buf = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...buf], [...bytes]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("handleDownloadGalleryAsset: missing asset → 404", async () => {
  const svc = new AssetService({ repository: new InMemoryAssetRepository([]) });
  const res = await handleDownloadGalleryAsset(svc, "missing");
  assert.equal(res.status, 404);
});

test("handleDownloadGalleryAsset: missing image urls → 404", async () => {
  const svc = new AssetService({
    repository: new InMemoryAssetRepository([
      asset({
        assetId: "no-url",
        driveFileId: null,
        thumbnailUrl: null,
        webViewUrl: null,
      }),
    ]),
  });
  const res = await handleDownloadGalleryAsset(svc, "no-url");
  assert.equal(res.status, 404);
});

test("handleDownloadGalleryAsset: upstream failure → 502", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 403 })) as typeof fetch;
  try {
    const svc = new AssetService({
      repository: new InMemoryAssetRepository([asset({ assetId: "bad" })]),
    });
    const res = await handleDownloadGalleryAsset(svc, "bad");
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gallery browser wires PhotoModal downloadUrl to the proxy path", () => {
  const src = readFileSync(path.join(process.cwd(), "components/gallery/gallery_browser.tsx"), "utf8");
  assert.match(src, /galleryAssetDownloadApiPath/);
  assert.match(src, /galleryAssetDownloadFilename/);
  assert.match(src, /downloadUrl=\{/);
});

test("PhotoModal prefers downloadUrl prop over cross-origin imageUrl", () => {
  const src = readFileSync(path.join(process.cwd(), "components/officer/photo_modal.tsx"), "utf8");
  assert.match(src, /downloadUrl/);
  assert.match(src, /resolvedDownloadUrl/);
  assert.match(src, /downloadFile\(resolvedDownloadUrl/);
});
