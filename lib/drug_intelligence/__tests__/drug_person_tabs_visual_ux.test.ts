/**
 * Person Detail tabs — Visual Intelligence presentation contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const page = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
const cards = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_workspace_cards.tsx"), "utf8");

test("Visual Intelligence card primitives exist", () => {
  assert.match(cards, /export function VisualIntelligenceCard/);
  assert.match(cards, /export function DiscoveryStatusBadge/);
  assert.match(cards, /export function CaseContextChip/);
  assert.match(cards, /export function ReviewStatusRow/);
  assert.match(cards, /kind: "REPEATED" \| "SOURCE_ONLY"/);
});

test("Cases tab uses compact cards without large relationship boxes as primary", () => {
  assert.match(page, /testId="person-case-card"/);
  assert.match(page, /case-badge-source/);
  assert.match(page, /case-badge-linked/);
  assert.match(page, /case-linked-counts/);
  assert.match(page, /di\.profile\.caseRoleInThisCase/);
  assert.match(page, /di\.profile\.caseLinkedShort/);
  assert.match(page, /VisualIntelligenceCard/);
});

test("Network roles keep confirmed vs unconfirmed distinction", () => {
  assert.match(page, /testId="person-network-role-card"/);
  assert.match(page, /verification-status/);
  assert.match(page, /di\.profile\.roleUnconfirmedWarn/);
  assert.match(page, /VerificationToneBadge/);
  assert.match(page, /RelationshipExplanation/);
});

test("Phone tab shows repeated vs source-only discovery states", () => {
  assert.match(page, /testId="person-phone-card"/);
  assert.match(page, /badgeRepeated/);
  assert.match(page, /badgeSourceOnly/);
  assert.match(page, /crossCaseInsight/);
  assert.match(page, /phoneNotRepeatedYet/);
  assert.match(page, /foundRepeatedHeading/);
});

test("SIM card shows co-appearing phones and case chip", () => {
  assert.match(page, /testId="person-sim-card"/);
  assert.match(page, /coAppearingNumbers/);
  assert.match(page, /relatedToThisPerson/);
});

test("Device and vehicle cards keep case context and media action", () => {
  assert.match(page, /testId="person-device-card"/);
  assert.match(page, /testId="person-vehicle-card"/);
  assert.match(page, /DrugEntityMediaAction entityType="DEVICE"/);
  assert.match(page, /DrugEntityMediaAction entityType="VEHICLE"/);
  assert.match(page, /deviceRelatedShort/);
  assert.match(page, /vehicleRelatedShort/);
});

test("Location cards stay non-causal and show case/map actions", () => {
  assert.match(page, /testId="person-location-card"/);
  assert.match(page, /locationNotPersonFact/);
  assert.match(page, /relatedViaCase/);
  assert.match(page, /viewOnMap/);
});

test("tabs do not promote raw UUID as primary card title", () => {
  assert.match(page, /preferHumanCaseLabel/);
  assert.match(page, /compactEntityId/);
  assert.doesNotMatch(page, /title=\{link\.caseId\}/);
  assert.doesNotMatch(page, /title=\{phone\.phoneNumberId\}/);
});

test("sourceCaseId investigation story and aggregate mode remain intact", () => {
  assert.match(page, /DrugPersonInvestigationStory/);
  assert.match(page, /DrugPersonInvestigationConclusion/);
  assert.match(page, /readPersonCaseContextParam/);
  assert.match(page, /resolvePersonProfileCaseContext/);
  assert.match(page, /!currentCaseId \? \(/);
  assert.match(page, /aggregateOverviewHeading/);
});

test("review tab uses scan-friendly status rows", () => {
  assert.match(page, /person-review-status-list/);
  assert.match(page, /ReviewStatusRow/);
  assert.match(page, /reviewNeedsAttention/);
});

test("entity tabs use IntelligenceCardGrid for low-count width balance", () => {
  assert.match(page, /IntelligenceCardGrid count=\{devices\.length\}/);
  assert.match(page, /IntelligenceCardGrid count=\{vehicles\.length\}/);
  assert.match(page, /IntelligenceCardGrid count=\{locations\.length\}/);
  assert.match(cards, /export function IntelligenceCardGrid/);
  assert.match(cards, /sm:max-w-\[70%\]/);
});
