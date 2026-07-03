import { test } from "node:test";
import assert from "node:assert/strict";
import { TextCleaner } from "@/lib/normalize/text_cleaner";

test("trims leading and trailing whitespace", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("   John Doe   "), "John Doe");
});

test("collapses multiple internal spaces to one", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("John    Doe"), "John Doe");
});

test("collapses duplicate blank lines", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("line one\n\n\n\nline two"), "line one\n\nline two");
});

test("normalizes en dash, em dash, and minus sign to a plain hyphen", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("2018 – 2020"), "2018 - 2020");
  assert.equal(cleaner.normalize("2018 — 2020"), "2018 - 2020");
  assert.equal(cleaner.normalize("2018 − 2020"), "2018 - 2020");
});

test("removes duplicated punctuation", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("Note.. Extra,, text"), "Note. Extra, text");
});

test("removes space before punctuation", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("Hello , world ."), "Hello, world.");
});

test("combined whitespace and dash and punctuation cleanup", () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.normalize("  Officer   report –  status:   OK..  "), "Officer report - status: OK.");
});
