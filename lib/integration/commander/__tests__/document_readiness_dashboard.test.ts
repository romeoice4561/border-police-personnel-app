import { test } from "node:test";
import assert from "node:assert/strict";

import { computeDocumentReadinessDashboardKpis } from "@/lib/integration/commander/document_readiness_dashboard";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { computeExpiryInfo } from "@/lib/document/document_expiry";
import { fixtureDoc, fullChecklistDocs } from "@/lib/integration/documents/__tests__/test_fixtures";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";

const ASOF = new Date("2026-07-21");

function fakeOfficer(officerId: string, documents: ReturnType<typeof fixtureDoc>[]): CommanderQueryOfficer {
  const documentIntelligence = composeOfficerDocumentIntelligence({ officerId, officerPk: 1, documents, asOf: ASOF });
  const documentExpiryInfo = computeExpiryInfo(documents, ASOF);
  return { documentIntelligence, documentExpiryInfo } as CommanderQueryOfficer;
}

test("empty officer list -> every KPI is 0, totalOfficers 0", () => {
  const kpis = computeDocumentReadinessDashboardKpis([]);
  assert.equal(kpis.totalOfficers, 0);
  assert.equal(kpis.readyCount, 0);
  assert.equal(kpis.blockedCount, 0);
});

test("readiness counts are mutually exclusive and sum to totalOfficers (excluding UNKNOWN, which is impossible from real documents)", () => {
  const officers = [
    fakeOfficer("a", fullChecklistDocs({ expiryDate: new Date("2030-01-01") })), // READY
    fakeOfficer("b", []), // INCOMPLETE
  ];
  const kpis = computeDocumentReadinessDashboardKpis(officers);
  assert.equal(kpis.readyCount, 1);
  assert.equal(kpis.incompleteCount, 1);
  assert.equal(kpis.readyCount + kpis.needsReviewCount + kpis.incompleteCount + kpis.blockedCount, kpis.totalOfficers);
});

test("expiredCount / expiringSoonCount count OFFICERS with at least one such document, not raw document counts", () => {
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01") }),
    fixtureDoc({ documentType: "DRIVER_LICENSE", expiryDate: new Date("2019-01-01") }),
  ];
  const officers = [fakeOfficer("a", docs)];
  const kpis = computeDocumentReadinessDashboardKpis(officers);
  assert.equal(kpis.expiredCount, 1, "one officer with two expired documents still counts as 1 officer, not 2");
});

test("blockedCount reflects officers with an expired required document", () => {
  const docs = fullChecklistDocs();
  docs[0] = { ...docs[0], expiryDate: new Date("2020-01-01") };
  const officers = [fakeOfficer("a", docs)];
  const kpis = computeDocumentReadinessDashboardKpis(officers);
  assert.equal(kpis.blockedCount, 1);
});
