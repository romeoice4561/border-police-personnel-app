import { test } from "node:test";
import assert from "node:assert/strict";
import { ThaiNumberConverter } from "@/lib/normalize/thai_number_converter";

test("converts a Buddhist-era year with Thai numerals to Arabic numerals", () => {
  const converter = new ThaiNumberConverter();
  assert.equal(converter.normalize("พ.ศ.๒๕๖๗"), "พ.ศ.2567");
});

test("converts a bare Thai numeral year", () => {
  const converter = new ThaiNumberConverter();
  assert.equal(converter.normalize("๒๕๖๔"), "2564");
});

test("converts a Thai-numeral phone number", () => {
  const converter = new ThaiNumberConverter();
  assert.equal(converter.normalize("๐๘๒-๗๕๔-๘๒๔๔"), "082-754-8244");
});

test("converts Thai numerals embedded in a sentence", () => {
  const converter = new ThaiNumberConverter();
  assert.equal(converter.normalize("ปี ๒๕๕๘"), "ปี 2558");
});

test("mixed Thai and Arabic numerals in the same string are all converted", () => {
  const converter = new ThaiNumberConverter();
  assert.equal(converter.normalize("๒๕๖๗ and 2024"), "2567 and 2024");
});

test("string with no Thai numerals is returned unchanged", () => {
  const converter = new ThaiNumberConverter();
  assert.equal(converter.normalize("Sergeant John Doe"), "Sergeant John Doe");
});

test("does not mutate behavior across repeated calls (pure function)", () => {
  const converter = new ThaiNumberConverter();
  const input = "๒๕๖๗";
  const first = converter.normalize(input);
  const second = converter.normalize(input);
  assert.equal(first, second);
  assert.equal(input, "๒๕๖๗"); // input untouched
});
