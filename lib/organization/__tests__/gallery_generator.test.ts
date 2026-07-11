import { test } from "node:test";
import assert from "node:assert/strict";

import { createGalleryDropdown, createGalleryUnitNames } from "@/lib/organization/gallery_generator";
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

// ── createGalleryUnitNames (Phase 27 Part 5) ──

test("createGalleryUnitNames defaults to the full shared company list when no companyList is supplied", () => {
  const names = createGalleryUnitNames("ชปข./ชปส.");
  assert.equal(names.length, COMPANY_NUMBER_CODES.length);
  assert.equal(names[0], "ชปข./ชปส.114");
  assert.equal(names.at(-1), "ชปข./ชปส.449");
});

test("createGalleryUnitNames scopes to an explicit companyList without duplicating any array", () => {
  const names = createGalleryUnitNames("ชปข./ชปส.", ["414", "415", "416"]);
  assert.deepEqual(names, ["ชปข./ชปส.414", "ชปข./ชปส.415", "ชปข./ชปส.416"]);
});

test("createGalleryUnitNames spaces the prefix when options.spaced is true", () => {
  const names = createGalleryUnitNames("แผนผังวางกำลังพล", ["414"], { spaced: true });
  assert.deepEqual(names, ["แผนผังวางกำลังพล 414"]);
});

test("createGalleryUnitNames every gallery type only supplies a prefix — no per-prefix special-casing", () => {
  for (const prefix of ["ชปข./ชปส.", "แผนผังวางกำลังพล", "แผนที่หน่วยข้างเคียง"]) {
    const names = createGalleryUnitNames(prefix, ["416"], { spaced: prefix !== "ชปข./ชปส." });
    assert.ok(names[0].includes("416"));
  }
});
