/**
 * Person Intelligence Workspace UX regression (Investigation Story release).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compactEntityId, looksLikeUuid } from "@/components/drug_intelligence/drug_person_workspace_cards";
import { ENTITY_MEDIA_UNSUPPORTED_TYPES, supportsEntityMediaAction } from "@/components/drug_intelligence/drug_entity_media_action";

const ROOT = process.cwd();

test("Person Media gallery renders a compact thumbnail strip", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_entity_media_gallery.tsx"), "utf8");
  assert.match(src, /data-testid="drug-entity-media-strip"/);
  assert.match(src, /h-\[76px\] w-\[76px\]/);
  assert.match(src, /overflow-x-auto/);
  assert.match(src, /\[scrollbar-width:none\]/);
  assert.doesNotMatch(src, /w-\[9\.5rem\]/);
  assert.doesNotMatch(src, /h-\[84px\]/);
});

test("contextual Entity Media action supports CASE/DEVICE/VEHICLE/LOCATION/PERSON only", () => {
  assert.equal(supportsEntityMediaAction("PERSON"), true);
  assert.equal(supportsEntityMediaAction("CASE"), true);
  assert.equal(supportsEntityMediaAction("DEVICE"), true);
  assert.equal(supportsEntityMediaAction("VEHICLE"), true);
  assert.equal(supportsEntityMediaAction("LOCATION"), true);
  assert.equal(supportsEntityMediaAction("PHONE"), false);
  assert.equal(supportsEntityMediaAction("SIM"), false);
  assert.deepEqual([...ENTITY_MEDIA_UNSUPPORTED_TYPES], ["PHONE", "SIM"]);
});

test("human-readable ID helper compactifies UUIDs", () => {
  assert.equal(looksLikeUuid("04d2ac30-976a-460d-b77d-31e74153e59f"), true);
  assert.equal(looksLikeUuid("DI-TEST-003"), false);
  assert.equal(compactEntityId("04d2ac30-976a-460d-b77d-31e74153e59f"), "04d2ac30…e59f");
});

test("Person workspace page wires investigation story and media actions", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(page, /IntelligenceSection/);
  assert.match(page, /MiniTimeline/);
  assert.match(page, /DrugEntityMediaAction/);
  assert.match(page, /DrugPersonInvestigationStory/);
  assert.match(page, /DrugPersonInvestigationConclusion/);
  assert.match(page, /person-supporting-section/);
  assert.match(page, /DrugEntityMediaGallery/);
  assert.match(page, /function IdentityTab/);
  assert.match(page, /function ReviewTab/);
  assert.match(page, /hasPortrait/);
  assert.match(page, /VerificationToneBadge/);
  assert.match(page, /RelationshipExplanation/);
  assert.match(page, /ImportantConnections/);
  assert.match(page, /VisualIntelligenceCard/);
  assert.match(page, /DiscoveryStatusBadge/);
  assert.match(page, /IntelligenceCardGrid/);
  assert.match(page, /flex-nowrap/);
  assert.doesNotMatch(page, /labelYOffset/);
  assert.doesNotMatch(page, /di\.profile\.knowAtGlance/);
});

test("analyst notes stay visually distinct from verified evidence", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_analyst_note_card.tsx"), "utf8");
  assert.match(src, /data-note-kind="analyst-observation"/);
  assert.match(src, /border-dashed/);
});

test("tab bar stays single-line with horizontal scroll", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(page, /data-testid="person-profile-tabs"/);
  assert.match(page, /flex flex-nowrap gap-1 overflow-x-auto/);
  assert.match(page, /shrink-0 whitespace-nowrap/);
  assert.match(page, /\[scrollbar-width:none\]/);
});

test("low-count IntelligenceCardGrid uses capped single-card width", () => {
  const cards = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_workspace_cards.tsx"), "utf8");
  assert.match(cards, /export function IntelligenceCardGrid/);
  assert.match(cards, /max-w-\[min\(100%,42rem\)\] sm:max-w-\[70%\]/);
  assert.match(cards, /data-testid="intelligence-card-grid"/);
  assert.match(cards, /count === 1/);
  assert.match(cards, /sm:grid-cols-2/);
});

test("Overview roles section is content-driven for low counts", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_relationship_explanation.tsx"), "utf8");
  assert.match(src, /data-testid="important-connections-grid"/);
  assert.match(src, /w-fit max-w-full/);
  assert.match(src, /items\.length === 1/);
  assert.match(src, /rolesFoundHeading/);
});
