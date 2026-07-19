import { test } from "node:test";
import assert from "node:assert/strict";

import { MISSING_DOCUMENT_GROUP, MISSING_DOCUMENT_GROUP_ORDER } from "@/lib/document/epf_missing_document_groups";
import { RECOMMENDED_CHECKLIST_CODES } from "@/lib/document/epf_intelligence";

// Phase 46C — static presentation-only grouping for the Missing Documents panel.

test("every recommended checklist code has exactly one panel group assigned", () => {
  for (const code of RECOMMENDED_CHECKLIST_CODES) {
    assert.ok(code in MISSING_DOCUMENT_GROUP, `${code} is missing a panel group assignment`);
  }
});

test("no stray codes exist in the grouping that aren't part of the real checklist", () => {
  const checklistSet = new Set(RECOMMENDED_CHECKLIST_CODES);
  for (const code of Object.keys(MISSING_DOCUMENT_GROUP)) {
    assert.ok(checklistSet.has(code), `${code} is grouped but not part of RECOMMENDED_CHECKLIST_CODES`);
  }
});

test("every group value is one of the three declared groups", () => {
  for (const group of Object.values(MISSING_DOCUMENT_GROUP)) {
    assert.ok(MISSING_DOCUMENT_GROUP_ORDER.includes(group));
  }
});
