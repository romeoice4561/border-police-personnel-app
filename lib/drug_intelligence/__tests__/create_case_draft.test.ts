/**
 * Unit tests for the Create Case draft → request builder (Phase DI-1 Round 2).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/create_case_draft.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCreateCaseRequest, createEmptyDraft, createEmptyPersonDraft, validateDraft } from "@/lib/drug_intelligence/create_case_draft";

test("validateDraft requires caseNumber and title", () => {
  const draft = createEmptyDraft();
  const errors = validateDraft(draft);
  assert.ok(errors.some((e) => e.message.includes("เลขคดี")));
  assert.ok(errors.some((e) => e.message.includes("ชื่อ/หัวข้อคดี")));
});

test("validateDraft requires a name for a NEW person, but not for an existing one", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.persons.push(createEmptyPersonDraft());
  const errors = validateDraft(draft);
  assert.ok(errors.some((e) => e.step === "persons"));

  const draft2 = createEmptyDraft();
  draft2.caseNumber = "X";
  draft2.title = "X";
  const existingPerson = createEmptyPersonDraft();
  existingPerson.existingPersonId = "person-1";
  draft2.persons.push(existingPerson);
  const errors2 = validateDraft(draft2);
  assert.equal(errors2.length, 0);
});

test("buildCreateCaseRequest normalizes Thai dates to the API's DD/MM/YYYY(BE) wire format and drops blank rows", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "ตชด.44-2569-001";
  draft.title = "ทดสอบ";
  draft.arrestDate = "15/1/2569"; // single-digit month input, normalized to zero-padded DD/MM/YYYY

  const person = createEmptyPersonDraft();
  person.primaryFullName = "ทดสอบ บุคคล";
  person.phones = [
    { key: "1", rawInput: "0812345678", firstSeenAt: "", lastSeenAt: "", notes: "" },
    { key: "2", rawInput: "", firstSeenAt: "", lastSeenAt: "", notes: "" }, // blank — must be dropped
  ];
  draft.persons.push(person);

  const request = buildCreateCaseRequest(draft, "mock:admin", "Administrator");

  assert.equal(request.caseNumber, "ตชด.44-2569-001");
  assert.equal(request.arrestDate, "15/01/2569", "normalizeThaiPersonnelDateForSave's own wire format (DD/MM/YYYY BE), not ISO — matches every other Thai-date field in this codebase");
  assert.equal(request.persons.length, 1);
  assert.equal(request.persons[0].newPerson?.primaryFullName, "ทดสอบ บุคคล");
  assert.equal(request.persons[0].phones.length, 1, "the blank phone row must be dropped, never sent as an empty string");
  assert.equal(request.persons[0].phones[0].rawInput, "0812345678");
  assert.equal(request.actorId, "mock:admin");
});

test("buildCreateCaseRequest sends existingPersonId (not newPerson) when a person was matched to an existing record", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  const person = createEmptyPersonDraft();
  person.existingPersonId = "person-abc";
  draft.persons.push(person);

  const request = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(request.persons[0].existingPersonId, "person-abc");
  assert.equal(request.persons[0].newPerson, undefined);
});

test("buildCreateCaseRequest reportingUnitText falls back through company > battalion > region > headquarters", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.regionText = "ภาค4";
  draft.battalionText = ""; // not selected
  const request = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(request.reportingUnitText, "ภาค4");
});
