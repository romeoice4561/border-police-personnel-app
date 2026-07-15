import { test } from "node:test";
import assert from "node:assert/strict";

import { documentStatus, DOCUMENT_STATUS_TONE, ACTIVE_DOCUMENT_STATUSES } from "@/lib/document/document_status";
import type { OfficerDocument } from "@/lib/database/query_types";

// Phase 45A — document display status (real states only).

function doc(ov: Partial<OfficerDocument>): OfficerDocument {
  return { id: 1, verifiedAt: null, isActive: true, ...ov } as OfficerDocument;
}

test("null document is 'missing'", () => {
  assert.equal(documentStatus(null), "missing");
  assert.equal(documentStatus(undefined), "missing");
});

test("a verified document (verifiedAt set) is 'verified'", () => {
  assert.equal(documentStatus(doc({ verifiedAt: new Date() })), "verified");
});

test("an uploaded but unverified document is 'pending'", () => {
  assert.equal(documentStatus(doc({ verifiedAt: null })), "pending");
});

test("only the real, backable statuses are exposed for filtering (no expired/rejected yet)", () => {
  assert.deepEqual([...ACTIVE_DOCUMENT_STATUSES], ["verified", "pending", "missing"]);
});

test("every status has a token tone (incl. the future expired/rejected)", () => {
  for (const s of ["verified", "pending", "missing", "expired", "rejected"] as const) {
    assert.ok(DOCUMENT_STATUS_TONE[s], `missing tone for ${s}`);
  }
});
