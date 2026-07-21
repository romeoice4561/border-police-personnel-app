import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryProcessingQueue, canTransition, InvalidQueueTransitionError } from "@/lib/extraction/processing_queue";

test("enqueue creates a QUEUED item with zero attempts", () => {
  const queue = new InMemoryProcessingQueue();
  const item = queue.enqueue({ id: "1", documentFingerprint: "fp", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  assert.equal(item.status, "QUEUED");
  assert.equal(item.attempts, 0);
});

test("legal transitions: QUEUED -> RUNNING -> COMPLETED", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "fp", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  const running = queue.transition("1", "RUNNING");
  assert.equal(running.status, "RUNNING");
  assert.equal(running.attempts, 1);
  assert.ok(running.startedAt);
  const completed = queue.transition("1", "COMPLETED");
  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completedAt);
});

test("illegal transition (QUEUED -> COMPLETED directly) throws InvalidQueueTransitionError", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "fp", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  assert.throws(() => queue.transition("1", "COMPLETED"), InvalidQueueTransitionError);
});

test("COMPLETED and CANCELLED are terminal — no further transitions allowed", () => {
  assert.equal(canTransition("COMPLETED", "QUEUED"), false);
  assert.equal(canTransition("CANCELLED", "RUNNING"), false);
});

test("FAILED items may re-enter QUEUED (retry), clearing the prior failureReason", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "fp", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  queue.transition("1", "RUNNING");
  const failed = queue.transition("1", "FAILED", { failureReason: "provider timeout" });
  assert.equal(failed.failureReason, "provider timeout");
  const retried = queue.transition("1", "QUEUED");
  assert.equal(retried.status, "QUEUED");
  assert.equal(retried.failureReason, null);
});

test("activeCount reflects only QUEUED and RUNNING items, not COMPLETED/FAILED/CANCELLED", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "fp1", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  queue.enqueue({ id: "2", documentFingerprint: "fp2", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  queue.enqueue({ id: "3", documentFingerprint: "fp3", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  queue.transition("2", "RUNNING");
  queue.transition("3", "RUNNING");
  queue.transition("3", "COMPLETED");
  assert.equal(queue.activeCount(), 2); // item 1 (QUEUED) + item 2 (RUNNING)
});

test("list() sorts HIGH priority before NORMAL, then by enqueue order", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "fp1", priority: "NORMAL", retryable: true, enqueuedAt: "2026-01-01T00:00:00.000Z" });
  queue.enqueue({ id: "2", documentFingerprint: "fp2", priority: "HIGH", retryable: true, enqueuedAt: "2026-01-01T00:00:01.000Z" });
  queue.enqueue({ id: "3", documentFingerprint: "fp3", priority: "NORMAL", retryable: true, enqueuedAt: "2026-01-01T00:00:02.000Z" });
  const order = queue.list().map((i) => i.id);
  assert.deepEqual(order, ["2", "1", "3"]);
});

test("get() returns null for an unknown id", () => {
  const queue = new InMemoryProcessingQueue();
  assert.equal(queue.get("nope"), null);
});

test("transition() throws for an unknown id", () => {
  const queue = new InMemoryProcessingQueue();
  assert.throws(() => queue.transition("nope", "RUNNING"));
});
