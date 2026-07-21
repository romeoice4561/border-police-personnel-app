import { test } from "node:test";
import assert from "node:assert/strict";

import { estimatePdfPageCount, decidePdfProcessing } from "@/lib/extraction/pdf_page_info";

function fakePdfBytes(pageCount: number): Uint8Array {
  const pages = Array.from({ length: pageCount }, () => "/Type /Page").join(" ");
  return new TextEncoder().encode(`%PDF-1.4\n${pages}\n/Type /Pages /Count ${pageCount}`);
}

test("estimatePdfPageCount counts /Type /Page occurrences, excluding /Type /Pages", () => {
  const info = estimatePdfPageCount(fakePdfBytes(3));
  assert.equal(info.pageCount, 3);
  assert.equal(info.countIsReliable, true);
});

test("estimatePdfPageCount on a single-page PDF", () => {
  const info = estimatePdfPageCount(fakePdfBytes(1));
  assert.equal(info.pageCount, 1);
});

test("estimatePdfPageCount returns countIsReliable=false when nothing matched", () => {
  const info = estimatePdfPageCount(new TextEncoder().encode("%PDF-1.4\nno page markers here"));
  assert.equal(info.pageCount, 0);
  assert.equal(info.countIsReliable, false);
});

test("decidePdfProcessing: allows automatic processing within the page limit", () => {
  const decision = decidePdfProcessing({ pageCount: 3, countIsReliable: true }, 5);
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresUserConfirmation, false);
});

test("decidePdfProcessing: exactly at the limit is allowed", () => {
  const decision = decidePdfProcessing({ pageCount: 5, countIsReliable: true }, 5);
  assert.equal(decision.allowed, true);
});

test("decidePdfProcessing: blocks automatic processing above the limit, requires confirmation", () => {
  const decision = decidePdfProcessing({ pageCount: 6, countIsReliable: true }, 5);
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresUserConfirmation, true);
});

test("decidePdfProcessing: an unreliable count is treated as requiring confirmation, never assumed small", () => {
  const decision = decidePdfProcessing({ pageCount: 0, countIsReliable: false }, 5);
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresUserConfirmation, true);
});

test("decidePdfProcessing: a large GP7-style PDF (many pages) is never auto-allowed", () => {
  const decision = decidePdfProcessing({ pageCount: 50, countIsReliable: true }, 5);
  assert.equal(decision.allowed, false);
});
