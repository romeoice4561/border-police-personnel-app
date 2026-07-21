import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesDocumentIntelligenceFilters } from "@/lib/integration/navigation/document_filter_matching";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { computeExpiryInfo } from "@/lib/document/document_expiry";
import { fixtureDoc, fullChecklistDocs } from "@/lib/integration/documents/__tests__/test_fixtures";

const ASOF = new Date("2026-07-21");

function compose(documents: ReturnType<typeof fixtureDoc>[]) {
  const intelligence = composeOfficerDocumentIntelligence({ officerId: "test", officerPk: 1, documents, asOf: ASOF });
  const expiryInfo = computeExpiryInfo(documents, ASOF);
  return { intelligence, expiryInfo };
}

test("empty filters match every officer", () => {
  const { intelligence, expiryInfo } = compose([]);
  assert.equal(matchesDocumentIntelligenceFilters(intelligence, expiryInfo, {}), true);
});

test("documentReadiness filter matches only the exact level", () => {
  const { intelligence, expiryInfo } = compose([]); // INCOMPLETE
  assert.equal(matchesDocumentIntelligenceFilters(intelligence, expiryInfo, { documentReadiness: "INCOMPLETE" }), true);
  assert.equal(matchesDocumentIntelligenceFilters(intelligence, expiryInfo, { documentReadiness: "READY" }), false);
});

test("expiryStatus 'expired' matches an officer with at least one expired document", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01") })];
  const { intelligence, expiryInfo } = compose(docs);
  assert.equal(matchesDocumentIntelligenceFilters(intelligence, expiryInfo, { expiryStatus: "expired" }), true);
  assert.equal(matchesDocumentIntelligenceFilters(intelligence, expiryInfo, { expiryStatus: "upcoming" }), false);
});

test("expiryStatus 'critical' matches expiring-soon within 30 days; 'warning' matches expiring-soon beyond 30 days", () => {
  const soon10 = new Date(ASOF);
  soon10.setUTCDate(soon10.getUTCDate() + 10);
  const soon60 = new Date(ASOF);
  soon60.setUTCDate(soon60.getUTCDate() + 60);

  const criticalDocs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: soon10 })];
  const warningDocs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: soon60 })];

  const critical = compose(criticalDocs);
  const warning = compose(warningDocs);

  assert.equal(matchesDocumentIntelligenceFilters(critical.intelligence, critical.expiryInfo, { expiryStatus: "critical" }), true);
  assert.equal(matchesDocumentIntelligenceFilters(critical.intelligence, critical.expiryInfo, { expiryStatus: "warning" }), false);

  assert.equal(matchesDocumentIntelligenceFilters(warning.intelligence, warning.expiryInfo, { expiryStatus: "warning" }), true);
  assert.equal(matchesDocumentIntelligenceFilters(warning.intelligence, warning.expiryInfo, { expiryStatus: "critical" }), false);
});

test("missingRequiredDocument=true matches only officers with at least one missing required document", () => {
  const complete = compose(fullChecklistDocs({ expiryDate: new Date("2030-01-01") }));
  const incomplete = compose([]);
  assert.equal(matchesDocumentIntelligenceFilters(complete.intelligence, complete.expiryInfo, { missingRequiredDocument: true }), false);
  assert.equal(matchesDocumentIntelligenceFilters(incomplete.intelligence, incomplete.expiryInfo, { missingRequiredDocument: true }), true);
});

test("combined filters require ALL specified fields to match (AND semantics)", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01") })];
  const { intelligence, expiryInfo } = compose(docs);
  assert.equal(
    matchesDocumentIntelligenceFilters(intelligence, expiryInfo, { documentReadiness: "BLOCKED", expiryStatus: "expired" }),
    true
  );
  assert.equal(
    matchesDocumentIntelligenceFilters(intelligence, expiryInfo, { documentReadiness: "READY", expiryStatus: "expired" }),
    false
  );
});
