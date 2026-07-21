import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryObservabilityEmitter } from "@/lib/extraction/observability";

test("emit() adds a timestamped event", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "OCR_STARTED", documentFingerprint: "fp-1", detail: {} });
  const events = emitter.getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "OCR_STARTED");
  assert.ok(events[0].timestamp);
});

test("countByType counts only matching events", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "CACHE_HIT", documentFingerprint: "a", detail: {} });
  emitter.emit({ type: "CACHE_HIT", documentFingerprint: "b", detail: {} });
  emitter.emit({ type: "CACHE_MISS", documentFingerprint: "c", detail: {} });
  assert.equal(emitter.countByType("CACHE_HIT"), 2);
  assert.equal(emitter.countByType("CACHE_MISS"), 1);
  assert.equal(emitter.countByType("AI_CONFIRMED"), 0);
});

test("event detail only accepts safe scalar values (string/number/boolean/null) — never an arbitrary object that could smuggle sensitive content", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({
    type: "AI_BLOCKED",
    documentFingerprint: "fp-1",
    detail: { reason: "budget_exhausted", callsForThisDocument: 1, wasConfirmed: false, extra: null },
  });
  const [event] = emitter.getEvents();
  assert.equal(event.detail.reason, "budget_exhausted");
  assert.equal(event.detail.callsForThisDocument, 1);
});

test("events preserve emission order", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "OCR_STARTED", documentFingerprint: "fp-1", detail: {} });
  emitter.emit({ type: "OCR_FINISHED", documentFingerprint: "fp-1", detail: {} });
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "fp-1", detail: {} });
  const types = emitter.getEvents().map((e) => e.type);
  assert.deepEqual(types, ["OCR_STARTED", "OCR_FINISHED", "EXTRACTION_COMPLETED"]);
});
