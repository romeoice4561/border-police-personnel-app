/**
 * createEmptyManualOfficerDraft tests (Phase XX.1).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATE_OFFICER_DRAFT_ID,
  createEmptyManualOfficerDraft,
  PLACEHOLDER_PORTRAIT,
} from "@/lib/manual_entry/create_officer_draft";

test("empty draft is Manual Entry shaped with empty nested collections", () => {
  const draft = createEmptyManualOfficerDraft();
  assert.equal(draft.source, "manual");
  assert.equal(draft.officerId, CREATE_OFFICER_DRAFT_ID);
  assert.equal(draft.rank, "");
  assert.equal(draft.firstName, "");
  assert.equal(draft.lastName, "");
  assert.deepEqual(draft.timeline, []);
  assert.deepEqual(draft.education, []);
  assert.deepEqual(draft.training, []);
  assert.deepEqual(draft.salaryHistory, []);
  assert.deepEqual(draft.skills, []);
  assert.deepEqual(draft.documents, []);
});

test("placeholder portrait is PLACEHOLDER with null urls", () => {
  assert.equal(PLACEHOLDER_PORTRAIT.source, "PLACEHOLDER");
  assert.equal(PLACEHOLDER_PORTRAIT.thumbnailUrl, null);
});
