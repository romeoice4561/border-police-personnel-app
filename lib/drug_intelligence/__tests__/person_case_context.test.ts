import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PERSON_CASE_CONTEXT_PARAM,
  readPersonCaseContextParam,
  resolvePersonProfileCaseContext,
  sanitizePersonCaseContextId,
} from "@/lib/drug_intelligence/person_case_context";

const linked = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];

test("sanitizePersonCaseContextId accepts a Drug UUID and rejects URLs/paths", () => {
  assert.equal(sanitizePersonCaseContextId(linked[0]), linked[0]);
  assert.equal(sanitizePersonCaseContextId("https://evil.example/x"), null);
  assert.equal(sanitizePersonCaseContextId("/drug-intelligence/cases/abc"), null);
  assert.equal(sanitizePersonCaseContextId("javascript:alert(1)"), null);
  assert.equal(sanitizePersonCaseContextId(""), null);
  assert.equal(sanitizePersonCaseContextId(null), null);
});

test("resolvePersonProfileCaseContext is MODE A only when the person is actually on that case", () => {
  assert.equal(resolvePersonProfileCaseContext(linked[0], linked), linked[0]);
  assert.equal(resolvePersonProfileCaseContext("33333333-3333-4333-8333-333333333333", linked), null, "unrelated case fails closed");
  assert.equal(resolvePersonProfileCaseContext("not-a-valid-id", linked), null);
  assert.equal(resolvePersonProfileCaseContext(null, linked), null);
});

test("returnTo is not a case-context source — only the caseId query param is", () => {
  const params = new URLSearchParams({
    returnTo: `/drug-intelligence/cases/${linked[0]}`,
  });
  assert.equal(params.get(PERSON_CASE_CONTEXT_PARAM), null);
  assert.equal(readPersonCaseContextParam(params), null);
  assert.equal(resolvePersonProfileCaseContext(params.get("returnTo"), linked), null);
});
