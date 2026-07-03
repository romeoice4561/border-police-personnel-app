/**
 * Unit tests for StrictJsonResponseParser.
 *
 * Run with: npx tsx --test lib/ai/__tests__/response_parser.test.ts
 * (uses Node's built-in test runner via `node:test`; no new test framework
 * dependency was added.)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { StrictJsonResponseParser } from "@/lib/ai/response_parser";
import { VisionParseError } from "@/lib/ai/vision_errors";

const SAMPLE_OBJECT = { rank: "Sergeant", first_name: "John", last_name: "Doe" };
const SAMPLE_JSON = JSON.stringify(SAMPLE_OBJECT);

test("bare JSON object parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const result = parser.parse(SAMPLE_JSON);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("bare JSON object with surrounding whitespace parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const result = parser.parse(`\n\n  ${SAMPLE_JSON}  \n`);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("markdown-fenced JSON with json language tag parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = "```json\n" + SAMPLE_JSON + "\n```";
  const result = parser.parse(wrapped);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("markdown-fenced JSON without language tag parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = "```\n" + SAMPLE_JSON + "\n```";
  const result = parser.parse(wrapped);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("leading explanation before JSON parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = `Here is the extracted information:\n\n${SAMPLE_JSON}`;
  const result = parser.parse(wrapped);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("leading label before JSON parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = `JSON:\n${SAMPLE_JSON}`;
  const result = parser.parse(wrapped);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("trailing explanation after JSON parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = `${SAMPLE_JSON}\n\nLet me know if you need anything else!`;
  const result = parser.parse(wrapped);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("leading and trailing explanation around JSON parses successfully", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = `Here is the data:\n\n${SAMPLE_JSON}\n\nHope that helps.`;
  const result = parser.parse(wrapped);
  assert.deepEqual(result, SAMPLE_OBJECT);
});

test("nested objects and braces inside string values do not break extraction", () => {
  const parser = new StrictJsonResponseParser();
  const nested = { notes: "Note with a { brace } and \"quoted\" text", timeline: [{ year: "2020" }] };
  const wrapped = `Result:\n${JSON.stringify(nested)}\nDone.`;
  const result = parser.parse(wrapped);
  assert.deepEqual(result, nested);
});

test("invalid JSON (malformed braces) throws VisionParseError", () => {
  const parser = new StrictJsonResponseParser();
  assert.throws(() => parser.parse("{ rank: Sergeant, }"), VisionParseError);
});

test("response with no JSON object at all throws VisionParseError", () => {
  const parser = new StrictJsonResponseParser();
  assert.throws(() => parser.parse("I could not extract any information from this image."), VisionParseError);
});

test("empty string throws VisionParseError", () => {
  const parser = new StrictJsonResponseParser();
  assert.throws(() => parser.parse(""), VisionParseError);
});

test("VisionParseError carries the original raw content for logging", () => {
  const parser = new StrictJsonResponseParser();
  const raw = "no json here";
  try {
    parser.parse(raw);
    assert.fail("expected parse to throw");
  } catch (error) {
    assert.ok(error instanceof VisionParseError);
    assert.equal((error as VisionParseError).rawContent, raw);
  }
});

test("extractJson returns the clean JSON substring without wrapping", () => {
  const parser = new StrictJsonResponseParser();
  const wrapped = `Here is the JSON:\n\n${SAMPLE_JSON}\n\nThanks!`;
  const extracted = parser.extractJson(wrapped);
  assert.equal(extracted, SAMPLE_JSON);
  assert.deepEqual(JSON.parse(extracted), SAMPLE_OBJECT);
});
