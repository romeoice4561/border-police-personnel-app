/**
 * Case List + Case Detail Visual Intelligence UX contracts (polish only).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("Case List uses compact operational cards with open-case primary action", () => {
  const page = read("app/drug-intelligence/cases/page.tsx");
  const card = read("components/drug_intelligence/drug_case_list_card.tsx");
  assert.match(page, /DrugCaseListCard/);
  assert.match(page, /data-testid="case-list-results"/);
  assert.doesNotMatch(page, /DrugCaseTable/);
  assert.doesNotMatch(page, /table-fixed/);
  assert.match(card, /data-testid="case-list-card"/);
  assert.match(card, /di\.list\.openCase/);
  assert.match(card, /row\.caseNumber/);
  assert.match(card, /row\.title/);
  assert.match(card, /row\.personCount/);
  assert.match(card, /row\.seizedItemCount/);
  assert.match(card, /DrugCaseStatusBadge/);
});

test("Case Detail uses identity header and intelligence summary instead of large KPI tiles", () => {
  const page = read("app/drug-intelligence/cases/[id]/page.tsx");
  const header = read("components/drug_intelligence/drug_case_identity_header.tsx");
  const summary = read("components/drug_intelligence/drug_case_intelligence_summary.tsx");
  assert.match(page, /DrugCaseIdentityHeader/);
  assert.match(page, /DrugCaseIntelligenceSummary/);
  assert.match(page, /DrugWorkspaceTabBar/);
  assert.match(page, /data-testid="case-primary-network"/);
  assert.doesNotMatch(page, /DrugKpiTile/);
  assert.doesNotMatch(page, /PageHeader/);
  assert.match(header, /data-testid="case-visual-identity"/);
  assert.match(header, /di\.workspace\.technicalDetails/);
  assert.match(header, /DrugEntityVisualThumb/);
  assert.match(summary, /data-testid="case-intelligence-summary"/);
  assert.match(summary, /data-testid="case-intelligence-stats"/);
  assert.match(summary, /di\.workspace\.intelligenceSummary/);
  assert.match(page, /DrugCaseConnectedCasesSection/);
  const cards = read("components/drug_intelligence/drug_cross_case_connection_cards.tsx");
  assert.match(cards, /data-testid="case-connected-cases"/);
});

test("Case Detail entity tabs reuse VisualIntelligenceCard language", () => {
  const page = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(page, /VisualIntelligenceCard/);
  assert.match(page, /IntelligenceCardGrid/);
  assert.match(page, /testId="case-person-card"/);
  assert.match(page, /casePersonInvestigationHref/);
  assert.match(page, /di\.person\.viewProfile/);
  assert.match(page, /di\.workspace\.openSim/);
  assert.match(page, /compactEntityId/);
});

test("Case workspace keeps investigator contact before units team", () => {
  const detail = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(detail, /DrugCaseInvestigatorContactCard/);
  const unitsIdx = detail.indexOf("DrugCaseUnitsAndTeamCard");
  const contactIdx = detail.indexOf("DrugCaseInvestigatorContactCard");
  assert.ok(contactIdx > 0 && contactIdx < unitsIdx);
});

test("Case identity header regression: the actions column is width-bounded, so an extra header button (e.g. returnTo's back-to-network link) can never starve the identity/metadata column into character-by-character wrapping", () => {
  const header = read("components/drug_intelligence/drug_case_identity_header.tsx");
  // The identity/metadata column must remain flexible and allowed to actually
  // shrink-to-grow (min-w-0 + flex-1) — this half of the bug was already
  // correct; asserted here so a future edit can't silently remove it.
  assert.match(header, /min-w-0 w-full flex-1 basis-0/);
  // The actions column must be bounded (max-w-*) at md+ so its own internal
  // flex-wrap triggers before it can grow wide enough to compress its sibling.
  // A bare `shrink-0` with no width ceiling was the actual regression: the
  // browser gave the actions column its full unbounded preferred width first,
  // and reduced the identity column to whatever was left over.
  assert.match(header, /md:max-w-/, "the actions column must have an md+ max-width bound");
  assert.match(header, /className="flex w-full shrink-0 flex-wrap[^"]*md:max-w-/);
});

test("Case Detail header actions include the returnTo back-to-network link only when returnTo is present, alongside the always-present network/timeline/list actions", () => {
  const page = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(page, /data-testid="back-via-return-to"/);
  assert.match(page, /\{returnTo \? \(/);
  assert.match(page, /returnToBackLabelKey/);
  assert.match(page, /data-testid="case-primary-network"/);
  assert.match(page, /di\.timeline\.navLabel/);
  assert.match(page, /di\.workspace\.backToList/);
});
