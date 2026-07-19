/**
 * Informal identity line (nickname · academy class) for the officer hero.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  formatOfficerInformalIdentity,
  normalizeAcademyClassValue,
} from "@/lib/officer_profile/informal_identity";

const root = path.resolve(import.meta.dirname, "../../..");

test("nickname + class → โตส · นรต.61", () => {
  assert.equal(formatOfficerInformalIdentity({ nickname: "โตส", academyClass: "61" }), "โตส · นรต.61");
  assert.equal(formatOfficerInformalIdentity({ nickname: "โตส", academyClass: 61 }), "โตส · นรต.61");
});

test("nickname only → โตส", () => {
  assert.equal(formatOfficerInformalIdentity({ nickname: "โตส", academyClass: null }), "โตส");
});

test("class only → นรต.61", () => {
  assert.equal(formatOfficerInformalIdentity({ nickname: null, academyClass: 61 }), "นรต.61");
  assert.equal(formatOfficerInformalIdentity({ nickname: "  ", academyClass: 61 }), "นรต.61");
});

test("neither → null (no empty placeholder)", () => {
  assert.equal(formatOfficerInformalIdentity({ nickname: null, academyClass: null }), null);
  assert.equal(formatOfficerInformalIdentity({ nickname: "", academyClass: null }), null);
  assert.equal(formatOfficerInformalIdentity({ nickname: "   ", academyClass: "" }), null);
});

test("class normalization: 61 / นรต.61 / นรต.รุ่น 61 → 61, never นรต.นรต.61", () => {
  assert.equal(normalizeAcademyClassValue(61), 61);
  assert.equal(normalizeAcademyClassValue("61"), 61);
  assert.equal(normalizeAcademyClassValue("นรต.61"), 61);
  assert.equal(normalizeAcademyClassValue("นรต.รุ่น 61"), 61);
  assert.equal(formatOfficerInformalIdentity({ nickname: null, academyClass: "นรต.61" }), "นรต.61");
  assert.notEqual(formatOfficerInformalIdentity({ nickname: null, academyClass: "นรต.61" }), "นรต.นรต.61");
});

test("English line uses Police Cadet Class N", () => {
  assert.equal(
    formatOfficerInformalIdentity({ nickname: "Tose", academyClass: 61 }, "en"),
    "Tose · Police Cadet Class 61"
  );
});

test("edit form: academyClass lives in ProfileEditor after nickname, not in Membership", async () => {
  const profileEditor = await fs.readFile(path.join(root, "components/officer/profile_editor.tsx"), "utf8");
  const membershipEditor = await fs.readFile(path.join(root, "components/officer/membership_financial_editor.tsx"), "utf8");
  const membershipSection = await fs.readFile(path.join(root, "components/officer/membership_financial_section.tsx"), "utf8");

  assert.ok(profileEditor.includes('id="edit-nickname"'));
  assert.ok(profileEditor.includes('id="edit-academyClass"'));
  const nickIdx = profileEditor.indexOf('id="edit-nickname"');
  const classIdx = profileEditor.indexOf('id="edit-academyClass"');
  assert.ok(nickIdx >= 0 && classIdx > nickIdx, "academyClass control must appear after nickname in ProfileEditor");

  assert.ok(!membershipEditor.includes('id="edit-academyClass"'));
  assert.ok(!membershipEditor.includes("ACADEMY_CLASS_OPTIONS"));
  assert.ok(!membershipSection.includes('labelKey="academyClass"'));
  assert.ok(!membershipSection.includes("formatAcademyClassTh"));
});

test("hero renders informal identity between position and phone", async () => {
  const header = await fs.readFile(path.join(root, "components/officer/officer_intelligence_header.tsx"), "utf8");
  assert.ok(header.includes("formatOfficerInformalIdentity"));
  assert.ok(header.includes('data-testid="officer-informal-identity"'));
  assert.ok(header.includes("nickname"));
  assert.ok(header.includes("academyClass"));

  // Markup order in the identity column (not import order).
  const posMarkup = header.indexOf("identity.position ?");
  const informalMarkup = header.indexOf('data-testid="officer-informal-identity"');
  const phoneMarkup = header.indexOf("<PhoneAction");
  assert.ok(posMarkup >= 0 && informalMarkup > posMarkup && phoneMarkup > informalMarkup);
});
