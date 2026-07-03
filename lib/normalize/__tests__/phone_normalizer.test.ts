import { test } from "node:test";
import assert from "node:assert/strict";
import { PhoneNormalizer } from "@/lib/normalize/phone_normalizer";

test("normalizes a plain 10-digit number with no separators", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize("0827548244"), "082-754-8244");
});

test("normalizes a space-separated number", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize("082 754 8244"), "082-754-8244");
});

test("normalizes a partially-hyphenated number", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize("082-7548244"), "082-754-8244");
});

test("already correctly formatted number is returned unchanged", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize("082-754-8244"), "082-754-8244");
});

test("non-10-digit number is left unchanged rather than guessed at", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize("02-123-4567"), "02-123-4567"); // 9 digits, landline-style
});

test("empty string is left unchanged", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize(""), "");
});

test("non-numeric garbage is left unchanged", () => {
  const normalizer = new PhoneNormalizer();
  assert.equal(normalizer.normalize("call me"), "call me");
});
