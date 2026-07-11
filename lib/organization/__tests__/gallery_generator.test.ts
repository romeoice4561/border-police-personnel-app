import { test } from "node:test";
import assert from "node:assert/strict";

import { createGalleryDropdown } from "@/lib/organization/gallery_generator";
import { COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

test("createGalleryDropdown concatenates by default", () => {
  const options = createGalleryDropdown({ prefix: "ชปข." });
  assert.equal(options.length, COMPANY_NUMBER_CODES.length);
  assert.deepEqual(options[0], { value: "ชปข.114", label: "ชปข.114" });
});

test("createGalleryDropdown spaces the prefix when spaced: true", () => {
  const options = createGalleryDropdown({ prefix: "แผนผังวางกำลังพล", spaced: true });
  assert.deepEqual(options[0], { value: "แผนผังวางกำลังพล 114", label: "แผนผังวางกำลังพล 114" });
});

test("works with ANY prefix, no per-prefix special-casing", () => {
  const options = createGalleryDropdown({ prefix: "หน่วยงานทดสอบ" });
  assert.ok(options.every((o) => o.value.startsWith("หน่วยงานทดสอบ")));
});
