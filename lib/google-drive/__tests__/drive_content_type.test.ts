/**
 * Unit tests for Drive content-type classification (Phase 18B). Pure — no
 * OCR, no OpenAI, no Drive, no I/O. Verifies every routing rule + UNKNOWN.
 *
 * Run with:
 *   npx tsx --test lib/google-drive/__tests__/drive_content_type.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyFolderContentType, DriveContentType, isProfileContent } from "@/lib/google-drive/drive_content_type";

test("Profile-prefixed folders → PROFILE", () => {
  assert.equal(classifyFolderContentType("Profile รายบุคคล ภาค 1"), DriveContentType.Profile);
  assert.equal(classifyFolderContentType("Profile รายบุคคล ภาค 4"), DriveContentType.Profile);
  assert.equal(classifyFolderContentType("Profile"), DriveContentType.Profile);
});

test("แผนที่หน่วยข้างเคียง-prefixed folders → NEIGHBOR_MAP", () => {
  assert.equal(classifyFolderContentType("แผนที่หน่วยข้างเคียง ภาค 1"), DriveContentType.NeighborMap);
  assert.equal(classifyFolderContentType("แผนที่หน่วยข้างเคียง ภาค 3"), DriveContentType.NeighborMap);
});

test("แผนผังโครงสร้าง-prefixed folders → ORG_CHART", () => {
  assert.equal(classifyFolderContentType("แผนผังโครงสร้างชุด ชปข. ภาค 1"), DriveContentType.OrgChart);
});

test("แผนผังการวางกำลัง-prefixed folders → DEPLOYMENT_MAP", () => {
  assert.equal(classifyFolderContentType("แผนผังการวางกำลัง ภาค 1"), DriveContentType.DeploymentMap);
});

test("แผนที่ตั้งกองร้อย (exact) → COMPANY_LOCATION", () => {
  assert.equal(classifyFolderContentType("แผนที่ตั้งกองร้อย"), DriveContentType.CompanyLocation);
});

test("แผนที่ตั้ง กองกำกับ ตชด (exact) → BATTALION_LOCATION", () => {
  assert.equal(classifyFolderContentType("แผนที่ตั้ง กองกำกับ ตชด"), DriveContentType.BattalionLocation);
});

test("matching is whitespace-tolerant (collapsed + trimmed)", () => {
  assert.equal(classifyFolderContentType("  Profile   รายบุคคล ภาค 1  "), DriveContentType.Profile);
  assert.equal(classifyFolderContentType("แผนที่ตั้ง  กองกำกับ  ตชด"), DriveContentType.BattalionLocation);
});

test("unrelated / empty / nullish folders → UNKNOWN", () => {
  assert.equal(classifyFolderContentType("ตชด.447"), DriveContentType.Unknown); // a nested unit folder, not top-level
  assert.equal(classifyFolderContentType("Random Folder"), DriveContentType.Unknown);
  assert.equal(classifyFolderContentType(""), DriveContentType.Unknown);
  assert.equal(classifyFolderContentType(null), DriveContentType.Unknown);
  assert.equal(classifyFolderContentType(undefined), DriveContentType.Unknown);
});

test("a folder that merely contains (not starts with) a keyword is UNKNOWN", () => {
  assert.equal(classifyFolderContentType("ข้อมูล Profile รายบุคคล"), DriveContentType.Unknown);
});

test("isProfileContent flags only PROFILE (the OCR/OpenAI-eligible type)", () => {
  assert.equal(isProfileContent(DriveContentType.Profile), true);
  assert.equal(isProfileContent(DriveContentType.NeighborMap), false);
  assert.equal(isProfileContent(DriveContentType.Unknown), false);
});
