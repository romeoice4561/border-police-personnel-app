import { test } from "node:test";
import assert from "node:assert/strict";

import { toDownloadName } from "@/lib/ui/download_file";

// Phase 45A — download filename builder (pure part of the download helper).

test("replaces whitespace with underscores and strips unsafe characters", () => {
  assert.equal(toDownloadName("พล.ต.ต. สมชาย ใจดี"), "พล.ต.ต._สมชาย_ใจดี");
  assert.equal(toDownloadName("John Q. Public"), "John_Q._Public");
});

test("applies suffix and extension", () => {
  assert.equal(toDownloadName("photo", { suffix: "42", ext: "jpg" }), "photo_42.jpg");
  assert.equal(toDownloadName("photo", { ext: ".png" }), "photo.png");
});

test("falls back to 'file' for empty / all-unsafe input", () => {
  assert.equal(toDownloadName(""), "file");
  assert.equal(toDownloadName("///"), "file");
  assert.equal(toDownloadName("   "), "file");
});

test("keeps dots and hyphens (valid filename chars)", () => {
  assert.equal(toDownloadName("gp7-2567.final"), "gp7-2567.final");
});
