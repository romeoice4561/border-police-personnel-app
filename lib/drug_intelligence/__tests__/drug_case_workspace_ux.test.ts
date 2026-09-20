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
