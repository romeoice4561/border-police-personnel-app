/**
 * Unit tests for the ImageCategory -> PortraitClassification mapping
 * (Phase 24B-3).
 *
 * Run with:
 *   npx tsx --test lib/profile_photo/__tests__/image_category_mapping.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { toPortraitClassification } from "@/lib/profile_photo/image_category_mapping";
import { PortraitClassification } from "@/lib/profile_photo/profile_photo_types";
import type { ImageCategory } from "@/lib/classifier/classification_types";

test("PERSONNEL_PROFILE maps to REAL_PERSON", () => {
  assert.equal(toPortraitClassification("PERSONNEL_PROFILE"), PortraitClassification.RealPerson);
});

test("ORGANIZATION_CHART maps to ORGANIZATION", () => {
  assert.equal(toPortraitClassification("ORGANIZATION_CHART"), PortraitClassification.Organization);
});

test("MAP maps to MAP", () => {
  assert.equal(toPortraitClassification("MAP"), PortraitClassification.Map);
});

test("document-like categories (TIMELINE/COVER_PAGE/TITLE_PAGE/TABLE/DIAGRAM/INDEX_PAGE) map to DOCUMENT", () => {
  const documentLike: ImageCategory[] = ["TIMELINE", "COVER_PAGE", "TITLE_PAGE", "TABLE", "DIAGRAM", "INDEX_PAGE"];
  for (const category of documentLike) {
    assert.equal(toPortraitClassification(category), PortraitClassification.Document, `expected ${category} -> DOCUMENT`);
  }
});

test("UNKNOWN maps to UNKNOWN", () => {
  assert.equal(toPortraitClassification("UNKNOWN"), PortraitClassification.Unknown);
});

test("every ImageCategory value has an explicit mapping (no silent fallback needed)", () => {
  const allCategories: ImageCategory[] = [
    "PERSONNEL_PROFILE",
    "TIMELINE",
    "ORGANIZATION_CHART",
    "COVER_PAGE",
    "TITLE_PAGE",
    "TABLE",
    "MAP",
    "DIAGRAM",
    "INDEX_PAGE",
    "UNKNOWN",
  ];
  for (const category of allCategories) {
    const result = toPortraitClassification(category);
    assert.ok(Object.values(PortraitClassification).includes(result), `mapping for ${category} must be a valid PortraitClassification`);
  }
});
