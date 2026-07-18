import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCourseName } from "@/lib/intelligence/training/course_normalization";

test("7. exact normalized-key match — identical cleaned text always produces the same key", () => {
  const a = normalizeCourseName("หลักสูตรผู้กำกับการ");
  const b = normalizeCourseName("หลักสูตรผู้กำกับการ");
  assert.equal(a.normalizedCourseKey, b.normalizedCourseKey);
  assert.equal(a.confidence, "exact");
});

test("whitespace/punctuation cleanup: extra spaces and repeated dots collapse to the same key", () => {
  const a = normalizeCourseName("หลักสูตร   ผกก..");
  const b = normalizeCourseName("หลักสูตร ผกก.");
  assert.equal(a.normalizedCourseKey, b.normalizedCourseKey);
});

test("9. ambiguous/dissimilar course names do NOT match — no fuzzy matching", () => {
  const a = normalizeCourseName("หลักสูตรผู้กำกับการ");
  const b = normalizeCourseName("หลักสูตรสืบสวน");
  assert.notEqual(a.normalizedCourseKey, b.normalizedCourseKey);
});

test("blank/whitespace-only course name -> unmatched, null key, never guessed", () => {
  const result = normalizeCourseName("   ");
  assert.equal(result.normalizedCourseKey, null);
  assert.equal(result.confidence, "unmatched");
});

test("null/undefined course name -> unmatched, never throws", () => {
  assert.equal(normalizeCourseName(null).confidence, "unmatched");
  assert.equal(normalizeCourseName(undefined).confidence, "unmatched");
});

test("original name is always preserved verbatim, even when normalization changes the key", () => {
  const result = normalizeCourseName("  หลักสูตร ผกก.  ");
  assert.equal(result.originalName, "  หลักสูตร ผกก.  ");
});
