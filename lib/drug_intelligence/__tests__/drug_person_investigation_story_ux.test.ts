/**
 * Person investigation-story UX — scannable origin → discovery presentation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInvestigationConclusionModel,
  collectInvestigationDiscoveries,
  partitionEntityCasesByOrigin,
} from "@/lib/drug_intelligence/drug_person_investigation_origin";

const ROOT = process.cwd();

test("investigation story wires entity chips and per-entity discovery without ownership claims", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_provenance.tsx"), "utf8");
  assert.match(src, /data-testid="person-investigation-story"/);
  assert.match(src, /data-testid="person-source-entity-chips"/);
  assert.match(src, /data-testid="person-discovery-item"/);
  assert.match(src, /data-testid="person-discovery-sentence"/);
  assert.match(src, /data-testid="person-no-repeat-compact"/);
  assert.match(src, /data-testid="person-origin-scan-bridge"/);
  assert.match(src, /data-testid="person-investigation-conclusion"/);
  assert.match(src, /discoveryPhoneRepeat|discoveryRepeatSentence/);
  assert.match(src, /foundInThisCase/);
  assert.match(src, /additionalLinksFoundHeading|systemDiscoveredLinks/);
  assert.match(src, /noRepeatCompact/);
  assert.match(src, /startedFromCase/);
  assert.match(src, /conclusionViewAllLinks/);
  assert.doesNotMatch(src, /เจ้าของ|ครอบครอง|ใช้เบอร์|เดินทางไป|มีความผิด/);
});

test("Person page keeps KPIs below story transition when origin is present", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(page, /DrugPersonInvestigationStory/);
  assert.match(page, /DrugPersonInvestigationConclusion/);
  assert.match(page, /person-post-scan-overview/);
  assert.match(page, /di\.profile\.postScanOverview/);
  assert.match(page, /person-supporting-section/);
  assert.match(page, /di\.profile\.rolesFoundHeading/);
  assert.match(page, /di\.profile\.profileSupportingSection/);
  assert.doesNotMatch(page, /person-origin-entity-counts/);
  assert.match(page, /phones: currentCaseId\s*\?\s*\[\]/);
  assert.match(page, /!currentCaseId \? \(/);
  assert.match(page, /di\.profile\.aggregateOverviewHeading/);
});

test("discovery partition still separates source from repeated cases", () => {
  const part = partitionEntityCasesByOrigin(
    [
      { caseId: "c3", caseNumber: "DI-TEST-003" },
      { caseId: "c1", caseNumber: "DI-TEST-001" },
      { caseId: "c2", caseNumber: "DI-TEST-002" },
    ],
    "c3",
  );
  assert.deepEqual(part.sourceLabels, ["DI-TEST-003"]);
  assert.deepEqual(part.discoveredLabels, ["DI-TEST-001", "DI-TEST-002"]);
  assert.equal(part.discoveredCount, 2);
});

test("investigation conclusion picks strongest repeated entity from provenance", () => {
  const entities = [
    {
      id: "ph1",
      kind: "PHONE" as const,
      label: "66900001001",
      cases: [
        { caseId: "c3", caseNumber: "DI-TEST-003" },
        { caseId: "c1", caseNumber: "DI-TEST-001" },
        { caseId: "c2", caseNumber: "DI-TEST-002" },
      ],
    },
    {
      id: "sim1",
      kind: "SIM" as const,
      label: "SIM-A",
      cases: [{ caseId: "c3", caseNumber: "DI-TEST-003" }],
    },
  ];
  const model = buildInvestigationConclusionModel(entities, "c3");
  assert.equal(model?.status, "has_discoveries");
  if (model?.status !== "has_discoveries") return;
  assert.equal(model.primary.id, "ph1");
  assert.equal(model.primary.discoveredCount, 2);
  assert.deepEqual(
    model.primary.discoveredCases.map((c) => c.label),
    ["DI-TEST-001", "DI-TEST-002"],
  );
  assert.equal(model.discoveryEntityCount, 1);
});

test("investigation conclusion reports no-repeat when source entities stay unique", () => {
  const model = buildInvestigationConclusionModel(
    [
      {
        id: "ph1",
        kind: "PHONE",
        label: "66900001001",
        cases: [{ caseId: "c3", caseNumber: "DI-TEST-003" }],
      },
    ],
    "c3",
  );
  assert.equal(model?.status, "no_discoveries");
});

test("investigation conclusion returns null in aggregate mode without sourceCaseId", () => {
  assert.equal(
    buildInvestigationConclusionModel(
      [
        {
          id: "ph1",
          kind: "PHONE",
          label: "66900001001",
          cases: [
            { caseId: "c1", caseNumber: "DI-TEST-001" },
            { caseId: "c2", caseNumber: "DI-TEST-002" },
          ],
        },
      ],
      null,
    ),
    null,
  );
});

test("multiple discoveries rank by discovered count then kind priority", () => {
  const hits = collectInvestigationDiscoveries(
    [
      {
        id: "loc1",
        kind: "LOCATION",
        label: "Border A",
        cases: [
          { caseId: "c3", caseNumber: "DI-TEST-003" },
          { caseId: "c1", caseNumber: "DI-TEST-001" },
          { caseId: "c2", caseNumber: "DI-TEST-002" },
          { caseId: "c4", caseNumber: "DI-TEST-004" },
        ],
      },
      {
        id: "ph1",
        kind: "PHONE",
        label: "66900001001",
        cases: [
          { caseId: "c3", caseNumber: "DI-TEST-003" },
          { caseId: "c1", caseNumber: "DI-TEST-001" },
          { caseId: "c2", caseNumber: "DI-TEST-002" },
        ],
      },
      {
        id: "veh1",
        kind: "VEHICLE",
        label: "ABC-123",
        cases: [
          { caseId: "c3", caseNumber: "DI-TEST-003" },
          { caseId: "c9", caseNumber: "DI-TEST-009" },
        ],
      },
    ],
    "c3",
  );
  assert.equal(hits[0]?.id, "loc1");
  assert.equal(hits[0]?.discoveredCount, 3);
  assert.equal(hits[1]?.id, "ph1");
  assert.equal(hits[2]?.id, "veh1");
  const model = buildInvestigationConclusionModel(
    [
      {
        id: "loc1",
        kind: "LOCATION",
        label: "Border A",
        cases: [
          { caseId: "c3", caseNumber: "DI-TEST-003" },
          { caseId: "c1", caseNumber: "DI-TEST-001" },
        ],
      },
      {
        id: "ph1",
        kind: "PHONE",
        label: "66900001001",
        cases: [
          { caseId: "c3", caseNumber: "DI-TEST-003" },
          { caseId: "c1", caseNumber: "DI-TEST-001" },
        ],
      },
    ],
    "c3",
  );
  assert.equal(model?.status, "has_discoveries");
  if (model?.status === "has_discoveries") {
    assert.equal(model.primary.kind, "PHONE");
    assert.equal(model.discoveryEntityCount, 2);
  }
});
