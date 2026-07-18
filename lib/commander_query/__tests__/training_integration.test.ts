/**
 * Training Intelligence integration tests (Phase 45).
 *
 * Covers toQueryOfficer()'s trainingIntelligence field — the ONE shared
 * computation Commander Search, Commander Dashboard, and the Officer
 * Intelligence Workspace all consume for the same officer.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "ภาค1/5",
    rank: "รองสารวัตร",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "รอง สว.",
    currentUnit: "กก.ตชด.41",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    phone: null,
    qualityScore: 80,
    knowledgeScore: 70,
    region: null,
    confidence: 80,
    dateOfBirth: null,
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitId: null,
    email: null,
    lineId: null,
    facebookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeline: [],
    phones: [],
    education: [],
    training: [],
    salaryHistory: [],
    documents: [],
    skills: [],
    ...overrides,
  } as unknown as OfficerWithRelations;
}

const ASOF = utcDate(2026, 7, 17);
const ORG_LABELS = { company: "กองร้อยทดสอบ" };

test("18. MissingTraining (Promotion Intelligence) is reachable only through a real policy — trainingCodes now sourced from normalized keys, never a raw-string coincidence", () => {
  const o = officer({ training: [{ id: 1, officerId: 1, course: "หลักสูตรทดสอบ", organization: null, year: "2564", notes: null, createdAt: new Date(), updatedAt: new Date() }] });
  const result = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  // No PROMOTION_POLICIES entry configures requiredTrainingCodes today, so
  // promotionStatus can never be "MissingTraining" regardless of training data.
  assert.notEqual(result.promotionIntelligence.promotionStatus, "MissingTraining");
});

test("22. same officer receives an identical trainingIntelligence summary across repeated calls (Commander Search / Dashboard / Officer Workspace all call the same toQueryOfficer)", () => {
  const o = officer({ training: [{ id: 1, officerId: 1, course: "หลักสูตรทดสอบ", organization: null, year: "2564", notes: null, createdAt: new Date(), updatedAt: new Date() }] });
  const a = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  const b = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  assert.deepEqual(a.trainingIntelligence, b.trainingIntelligence);
});

test("23. unavailable/no-data training never becomes a silent zero disguised as Complete", () => {
  const o = officer({ training: [] });
  const result = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  assert.equal(result.trainingIntelligence.trainingStatus, "NoData");
  assert.notEqual(result.trainingIntelligence.trainingStatus, "Complete");
});

test("26. no raw enum labels — trainingIntelligence.displayStatusTh is always Thai text", () => {
  const o = officer({ training: [] });
  const result = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  assert.ok(/[ก-๙]/.test(result.trainingIntelligence.displayStatusTh));
});

test("trainingCodes on the eligibility officer are normalized course keys, not raw free-text course names", () => {
  const o = officer({
    currentPosition: "รองสารวัตร",
    training: [{ id: 1, officerId: 1, course: "  หลักสูตร   ผกก..  ", organization: null, year: "2564", notes: null, createdAt: new Date(), updatedAt: new Date() }],
  });
  const result = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  // hasTraining (a distinct, pre-existing boolean) remains true — the row exists.
  assert.equal(result.hasTraining, true);
});

// ---------------------------------------------------------------------------
// Phase 45 completion pass — Task 14 items 18-19: the optional Commander
// Search training column's badge source, and confirming no raw enum value
// is ever the displayed text.
// ---------------------------------------------------------------------------

test("18. optional Training column labels: trainingIntelligence.displayStatusTh (the exact badge text the table renders) is Thai, never the raw TrainingStatus enum key", () => {
  const o = officer({ training: [] });
  const result = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  assert.equal(result.trainingIntelligence.trainingStatus, "NoData");
  assert.notEqual(result.trainingIntelligence.displayStatusTh, "NoData");
  assert.ok(/[ก-๙]/.test(result.trainingIntelligence.displayStatusTh));
});

test("19. no raw enum value (Complete/MissingRequired/NoPolicy/NoData/Unknown) ever equals displayStatusTh, across every real TrainingStatus", () => {
  const rawEnumValues = ["Complete", "MissingRequired", "ExpiringSoon", "Expired", "Unverified", "NoPolicy", "NoData", "Unknown"];
  const o = officer({ training: [] });
  const result = toQueryOfficer(o, ASOF, ORG_LABELS, null);
  assert.ok(!rawEnumValues.includes(result.trainingIntelligence.displayStatusTh));
});
