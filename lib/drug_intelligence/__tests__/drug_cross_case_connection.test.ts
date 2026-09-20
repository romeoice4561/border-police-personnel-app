/**
 * DI-8.2A — pure cross-case connection chronology + merge helpers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyCaseChronology,
  computeEntityOccurrenceBounds,
  mergeEvidenceByTargetCase,
  chronologyLabelTh,
  evidenceTypeLabelTh,
  sortCasesChronologically,
  earliestCase,
  latestCase,
  derivePersonOccurrenceBounds,
  toArrestTimeKey,
  type CrossCaseConnectionCaseSummary,
  type CrossCaseEvidenceItem,
} from "@/lib/drug_intelligence/drug_cross_case_connection";

const source: CrossCaseConnectionCaseSummary = {
  caseId: "c2",
  caseNumber: "DI-TEST-002",
  arrestDate: "2026-08-05",
  arrestTime: "18:20",
  province: "ระนอง",
  locationName: null,
  status: "OPEN",
};

function evidence(
  partial: Partial<CrossCaseEvidenceItem> & Pick<CrossCaseEvidenceItem, "entityType" | "entityId" | "displayValue">,
): CrossCaseEvidenceItem {
  return {
    displayLabel: evidenceTypeLabelTh(partial.entityType),
    relationshipType: `${partial.entityType}_CASE`,
    provenance: "SHARED_ENTITY",
    href: null,
    ...partial,
  };
}

test("CASE chronology: BEFORE / AFTER / SAME_DAY / UNKNOWN", () => {
  assert.equal(classifyCaseChronology("2026-08-05", "2026-08-01"), "BEFORE");
  assert.equal(classifyCaseChronology("2026-08-05", "2026-08-10"), "AFTER");
  assert.equal(classifyCaseChronology("2026-08-05", "2026-08-05"), "SAME_DAY");
  assert.equal(classifyCaseChronology(null, "2026-08-01"), "UNKNOWN");
  assert.equal(chronologyLabelTh("BEFORE"), "คดีก่อนหน้า");
  assert.equal(chronologyLabelTh("AFTER"), "คดีภายหลัง");
});

test("Person occurrence bounds from linked case arrest dates", () => {
  const bounds = computeEntityOccurrenceBounds(["2026-08-10", "2026-08-01", "2026-08-05", null]);
  assert.equal(bounds.firstRecordedAt, "2026-08-01");
  assert.equal(bounds.lastRecordedAt, "2026-08-10");
});

test("Selecting a middle case does not change global first/last bounds", () => {
  const all = computeEntityOccurrenceBounds(["2026-08-01", "2026-08-05", "2026-08-10"]);
  const withoutMiddle = computeEntityOccurrenceBounds(["2026-08-01", "2026-08-10"]);
  assert.equal(all.firstRecordedAt, withoutMiddle.firstRecordedAt);
  assert.equal(all.lastRecordedAt, withoutMiddle.lastRecordedAt);
});

test("DIRECT shared phone + person merge into one connected-case card with 2 evidence items", () => {
  const target: CrossCaseConnectionCaseSummary = {
    caseId: "c1",
    caseNumber: "DI-TEST-001",
    arrestDate: "2026-08-01",
    arrestTime: "21:30",
    province: "สุราษฎร์ธานี",
    locationName: null,
    status: "OPEN",
  };
  const connections = mergeEvidenceByTargetCase(source, [
    {
      targetCase: target,
      evidence: evidence({ entityType: "PERSON", entityId: "p2", displayValue: "นายกิตติศักดิ์ ทดสอบระบบ" }),
    },
    {
      targetCase: target,
      evidence: evidence({ entityType: "PHONE", entityId: "ph1", displayValue: "090-000-1001" }),
    },
    {
      targetCase: target,
      evidence: evidence({ entityType: "PERSON", entityId: "p2", displayValue: "นายกิตติศักดิ์ ทดสอบระบบ" }),
    },
  ]);
  assert.equal(connections.length, 1);
  assert.equal(connections[0]!.chronology, "BEFORE");
  assert.equal(connections[0]!.directness, "DIRECT");
  assert.equal(connections[0]!.evidenceItems.length, 2);
  assert.equal(connections[0]!.evidenceItems[0]!.displayLabel, "บุคคลเดียวกัน");
  assert.equal(connections[0]!.evidenceItems[1]!.displayLabel, "หมายเลขโทรศัพท์เดียวกัน");
});

test("Multiple evidence types (person + phone + vehicle) stay on one card", () => {
  const target: CrossCaseConnectionCaseSummary = {
    caseId: "c3",
    caseNumber: "DI-TEST-003",
    arrestDate: "2026-08-10",
    arrestTime: null,
    province: "สุราษฎร์ธานี",
    locationName: null,
    status: "OPEN",
  };
  const connections = mergeEvidenceByTargetCase(source, [
    { targetCase: target, evidence: evidence({ entityType: "PERSON", entityId: "p2", displayValue: "P" }) },
    { targetCase: target, evidence: evidence({ entityType: "PHONE", entityId: "ph1", displayValue: "090" }) },
    { targetCase: target, evidence: evidence({ entityType: "VEHICLE", entityId: "v1", displayValue: "Honda" }) },
  ]);
  assert.equal(connections.length, 1);
  assert.equal(connections[0]!.evidenceItems.length, 3);
  assert.equal(connections[0]!.chronology, "AFTER");
});

test("INDIRECT multi-hop is marked and does not look direct", () => {
  const target: CrossCaseConnectionCaseSummary = {
    caseId: "c4",
    caseNumber: "DI-TEST-004",
    arrestDate: "2026-08-20",
    arrestTime: null,
    province: null,
    locationName: null,
    status: "OPEN",
  };
  const connections = mergeEvidenceByTargetCase(source, [
    {
      targetCase: target,
      evidence: evidence({ entityType: "PHONE", entityId: "phx", displayValue: "masked", provenance: "INDIRECT_PATH" }),
      directness: "INDIRECT",
      hopCount: 2,
      pathPreview: ["DI-TEST-002", "Person A", "Phone X", "Person B", "DI-TEST-004"],
    },
  ]);
  assert.equal(connections[0]!.directness, "INDIRECT");
  assert.equal(connections[0]!.hopCount, 2);
  assert.ok(connections[0]!.pathPreview?.length);
});

test("Same province alone is not encoded as connection evidence in the helper", () => {
  const connections = mergeEvidenceByTargetCase(source, []);
  assert.equal(connections.length, 0);
  assert.equal(evidenceTypeLabelTh("SIM"), "SIM เดียวกัน");
  assert.equal(evidenceTypeLabelTh("DEVICE"), "อุปกรณ์ / IMEI เดียวกัน");
});

test("Case workspace surface wires connected-cases section", () => {
  const page = readFileSync(join(process.cwd(), "app/drug-intelligence/cases/[id]/page.tsx"), "utf8");
  const cards = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_cross_case_connection_cards.tsx"), "utf8");
  const inspector = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_network_node_detail.tsx"), "utf8");
  assert.match(page, /DrugCaseConnectedCasesSection/);
  assert.match(cards, /di\.connection\.openCase/);
  assert.match(cards, /di\.connection\.viewEvidence/);
  assert.match(cards, /di\.connection\.viewInGraph/);
  assert.match(inspector, /di\.network\.firstRecorded/);
  assert.match(inspector, /node\.type === "CASE"/);
  assert.doesNotMatch(inspector, /di\.network\.firstSeen/);
});

test("Person case chronology helpers: 001/002/003 order + earliest/latest", () => {
  const rows = [
    { caseId: "c2", caseNumber: "DI-TEST-002", arrestDate: "2026-08-05", arrestTime: "18:20" },
    { caseId: "c3", caseNumber: "DI-TEST-003", arrestDate: "2026-08-10", arrestTime: "14:00" },
    { caseId: "c1", caseNumber: "DI-TEST-001", arrestDate: "2026-08-01", arrestTime: "21:30" },
  ];
  const sorted = sortCasesChronologically(rows);
  assert.deepEqual(
    sorted.map((r) => r.caseNumber),
    ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"],
  );
  assert.equal(earliestCase(rows)?.caseNumber, "DI-TEST-001");
  assert.equal(latestCase(rows)?.caseNumber, "DI-TEST-003");
});

test("same-day ordering uses real times only; missing time is not 00:00", () => {
  assert.equal(toArrestTimeKey(null), null);
  assert.equal(toArrestTimeKey(""), null);
  assert.equal(toArrestTimeKey("21:30"), "21:30:00");

  const sorted = sortCasesChronologically([
    { caseId: "b", caseNumber: "B", arrestDate: "2026-08-01", arrestTime: null },
    { caseId: "a", caseNumber: "A", arrestDate: "2026-08-01", arrestTime: "09:00" },
    { caseId: "c", caseNumber: "C", arrestDate: "2026-08-01", arrestTime: "18:00" },
  ]);
  assert.deepEqual(
    sorted.map((r) => r.caseNumber),
    ["A", "C", "B"],
  );
});

test("occurrence fallback never uses audit timestamps", () => {
  const none = derivePersonOccurrenceBounds({ arrestDates: [null], observationTimestamps: [] });
  assert.equal(none.source, "NONE");
  assert.equal(none.firstRecordedAt, null);

  const fromObs = derivePersonOccurrenceBounds({
    arrestDates: [null],
    observationTimestamps: [new Date("2020-01-01"), new Date("2024-06-15")],
  });
  assert.equal(fromObs.source, "RELATIONSHIP_OBSERVATION");
  assert.equal(fromObs.firstRecordedAt, "2020-01-01");
  assert.equal(fromObs.lastRecordedAt, "2024-06-15");
});

test("Person overview never labels DI-TEST-001 as latest via cases[0]", () => {
  const page = readFileSync(join(process.cwd(), "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  const cards = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_person_workspace_cards.tsx"), "utf8");
  assert.match(page, /sortCasesChronologically/);
  assert.match(page, /earliestCase/);
  assert.match(page, /latestCase/);
  assert.match(page, /person-case-summary-chronology/);
  assert.match(page, /occurrenceFirstBadge/);
  assert.match(page, /occurrenceLastBadge/);
  assert.match(page, /MiniTimeline/);
  assert.match(cards, /person-mini-timeline/);
  assert.doesNotMatch(page, /di\.profile\.latestCase(?!Badge)/);
  assert.doesNotMatch(page, /\.sort\(\(a, b\) => new Date\(b\.case/);
});
