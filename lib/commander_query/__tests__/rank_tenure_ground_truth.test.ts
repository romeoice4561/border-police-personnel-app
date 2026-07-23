/**
 * Phase 49.8 — Rank Tenure & Data Confidence regression tests.
 *
 * Traces the SAME root-cause pattern Phase 49.7 fixed for position-level
 * tenure (a missing start date silently becoming a confirmed negative
 * result) applied to RANK tenure: `lib/commander_query/query_officer.ts`'s
 * `rankStartedAt = startedAtForMatchingTimeline(officer.timeline, (row) =>
 * row.rank === officer.rank)` requires an EXACT string match against
 * Timeline.rank (which is commonly null for un-backfilled rows — see
 * prisma/schema.prisma's Timeline.rank comment) with NO fallback
 * classifier (unlike position level's mapPositionTextToLevel). When no
 * match exists, `yearsInRank` is null, and previously this was treated
 * identically to a genuine tenure shortfall (`tenureBlocked = true`) —
 * this file proves it is now correctly routed to "Unknown"/"incomplete"
 * confidence instead.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "TEST-RANK-1",
    rank: "ร.ต.ท.",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "รอง ผบ.ร้อย ตชด.414",
    currentUnit: "ร้อย ตชด.414",
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

function timelineRow(overrides: Record<string, unknown>) {
  return {
    id: 1,
    officerId: 1,
    sequence: 0,
    year: String(overrides.yearBE ?? ""),
    isPresent: false,
    ...overrides,
  };
}

const ORG_LABELS = { company: "กองร้อยทดสอบ" };
const ASOF = utcDate(2026, 7, 20);

// A officer at รองสารวัตร level long enough (2557 -> 2569 = 12 years, well
// past the 7-year requirement) so ONLY the rank-tenure evidence gap is
// under test — position-level tenure is never the blocker here.
function baseTimelineRow(rank: string, overrides: Record<string, unknown> = {}) {
  return timelineRow({
    id: 1,
    sequence: 0,
    yearBE: 2557,
    year: "2557",
    appointmentCycle: 2557,
    position: "รอง ผบ.ร้อย ตชด.414",
    positionLevel: "รองสารวัตร",
    rank,
    unit: "ร้อย ตชด.414",
    isPresent: true,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Root-cause reproduction
// ---------------------------------------------------------------------------

test("1. exact current-rank timeline match: rankStartedAt resolves, yearsInRank is a real number, confidence is confirmed", () => {
  const result = toQueryOfficer(
    officer({ rank: "ร.ต.ท.", timeline: [baseTimelineRow("ร.ต.ท.")] }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.ok(result.yearsInRank != null && result.yearsInRank > 0);
  assert.equal(result.promotionIntelligence.confidence, "confirmed");
  assert.equal(result.promotionIntelligence.missingEvidence.length, 0);
});

test("2. current rank ABSENT from any timeline row (all rows have a DIFFERENT rank, e.g. imported rows with rank=null mapped to '' at the fixture layer): yearsInRank is null, no fabricated tenure", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [baseTimelineRow("ร.ต.ต.")], // only an OLDER rank on record — no exact match for current "ร.ต.ท."
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.yearsInRank, null);
});

test("3. missing rank evidence -> promotionStatus is Unknown, NEVER Waiting/NotEligible (the exact root-cause bug this phase fixes)", () => {
  const result = toQueryOfficer(
    officer({ rank: "ร.ต.ท.", timeline: [baseTimelineRow("ร.ต.ต.")] }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.promotionStatus, "Unknown");
  assert.notEqual(result.promotionIntelligence.promotionStatus, "Waiting");
  assert.notEqual(result.promotionIntelligence.promotionStatus, "NotEligible");
});

test("4. missing rank evidence -> eligibleNow is false, overdueYears is 0 — never fabricated positive results from an evidence gap", () => {
  const result = toQueryOfficer(
    officer({ rank: "ร.ต.ท.", timeline: [baseTimelineRow("ร.ต.ต.")] }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.eligibleNow, false);
  assert.equal(result.promotionIntelligence.overdueYears, 0);
});

test("5. missing rank evidence -> confidence is 'incomplete' with 'current_rank_start_date' in missingEvidence and a Thai reason", () => {
  const result = toQueryOfficer(
    officer({ rank: "ร.ต.ท.", timeline: [baseTimelineRow("ร.ต.ต.")] }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.confidence, "incomplete");
  assert.ok(result.promotionIntelligence.missingEvidence.includes("current_rank_start_date"));
  assert.equal(result.promotionIntelligence.confidenceReasonTh, "ไม่พบวันที่เริ่มครองยศปัจจุบัน");
});

// ---------------------------------------------------------------------------
// Continuous current-rank period (Part 4)
// ---------------------------------------------------------------------------

test("6. multiple same-rank rows: rankStartedAt uses the EARLIEST date of the continuous current-rank period, not a later transfer/reassignment row", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        baseTimelineRow("ร.ต.ต.", { id: 1, sequence: 0, yearBE: 2560, year: "2560", isPresent: false }),
        baseTimelineRow("ร.ต.ท.", { id: 2, sequence: 1, yearBE: 2563, year: "2563", isPresent: false }),
        // Transfer at the SAME rank — must not become the rank-start date.
        baseTimelineRow("ร.ต.ท.", { id: 3, sequence: 2, yearBE: 2565, year: "2565", position: "รอง ผบ.ร้อย ตชด.415", unit: "ร้อย ตชด.415", isPresent: false }),
        // Reassignment at the SAME rank — also must not become the rank-start date.
        baseTimelineRow("ร.ต.ท.", { id: 4, sequence: 3, yearBE: 2567, year: "2567", position: "รอง ผบ.ร้อย ตชด.414", unit: "ร้อย ตชด.414", isPresent: true }),
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  // yearsInRank as of 2569 from a 2563 start ~= 6.x years (not ~4.x from 2565, not ~2.x from 2567).
  assert.ok(result.yearsInRank != null && result.yearsInRank >= 6 && result.yearsInRank < 7, `expected ~6 years, got ${result.yearsInRank}`);
});

test("7. a unit transfer at the same rank does not reset rank tenure", () => {
  const withoutTransfer = toQueryOfficer(
    officer({ rank: "ร.ต.ท.", timeline: [baseTimelineRow("ร.ต.ท.", { yearBE: 2563, year: "2563" })] }),
    ASOF,
    ORG_LABELS,
    null
  );
  const withTransfer = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        baseTimelineRow("ร.ต.ท.", { id: 1, sequence: 0, yearBE: 2563, year: "2563", unit: "ร้อย ตชด.414", isPresent: false }),
        baseTimelineRow("ร.ต.ท.", { id: 2, sequence: 1, yearBE: 2567, year: "2567", unit: "ร้อย ตชด.415", isPresent: true }),
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(withTransfer.yearsInRank, withoutTransfer.yearsInRank, "transfer must not change the resolved rank tenure");
});

test("8. a position change (no rank change) does not reset rank tenure", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        baseTimelineRow("ร.ต.ท.", { id: 1, sequence: 0, yearBE: 2563, year: "2563", position: "รอง ผบ.ร้อย ตชด.414", isPresent: false }),
        baseTimelineRow("ร.ต.ท.", { id: 2, sequence: 1, yearBE: 2567, year: "2567", position: "รอง สว.(ป.) กก.ตชด.41", isPresent: true }),
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.ok(result.yearsInRank != null && result.yearsInRank >= 6 && result.yearsInRank < 7, `expected ~6 years anchored to 2563, got ${result.yearsInRank}`);
});

test("9. out-of-order timeline rows normalize correctly regardless of array order (earliest match found by date, not array position)", () => {
  const inOrder = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        baseTimelineRow("ร.ต.ท.", { id: 1, sequence: 0, yearBE: 2563, year: "2563" }),
        baseTimelineRow("ร.ต.ท.", { id: 2, sequence: 1, yearBE: 2567, year: "2567", isPresent: true }),
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  const reversed = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        baseTimelineRow("ร.ต.ท.", { id: 2, sequence: 1, yearBE: 2567, year: "2567", isPresent: true }),
        baseTimelineRow("ร.ต.ท.", { id: 1, sequence: 0, yearBE: 2563, year: "2563" }),
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(inOrder.yearsInRank, reversed.yearsInRank);
  assert.ok(inOrder.yearsInRank != null && inOrder.yearsInRank >= 6 && inOrder.yearsInRank < 7, `expected ~6 years, got ${inOrder.yearsInRank}`);
});

test("10. a previous LOWER rank row never becomes the current-rank start (only exact-rank-matching rows are considered)", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        baseTimelineRow("ร.ต.ต.", { id: 1, sequence: 0, yearBE: 2557, year: "2557" }), // lower rank, earlier
        baseTimelineRow("ร.ต.ท.", { id: 2, sequence: 1, yearBE: 2563, year: "2563", isPresent: true }), // current rank starts here
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.ok(
    result.yearsInRank != null && result.yearsInRank >= 6 && result.yearsInRank < 7,
    `must anchor to 2563 (current rank), never 2557 (the lower prior rank) — got ${result.yearsInRank}`
  );
});

test("11. malformed rank row (positionLevel/rank present but no yearBE/appointmentCycle) does not default to eligible", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        {
          id: 1,
          officerId: 1,
          sequence: 0,
          position: "รอง ผบ.ร้อย ตชด.414",
          positionLevel: "รองสารวัตร",
          rank: "ร.ต.ท.",
          unit: "ร้อย ตชด.414",
          isPresent: true,
          // No yearBE/year, no appointmentCycle.
        },
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.eligibleNow, false);
  assert.notEqual(result.promotionIntelligence.promotionStatus, "AlreadyEligible");
  assert.notEqual(result.promotionIntelligence.promotionStatus, "EligibleThisYear");
});

test("12. source timeline array is not mutated by toQueryOfficer", () => {
  const timeline = [baseTimelineRow("ร.ต.ท.")];
  const snapshotBefore = JSON.stringify(timeline);
  toQueryOfficer(officer({ rank: "ร.ต.ท.", timeline }), ASOF, ORG_LABELS, null);
  assert.equal(JSON.stringify(timeline), snapshotBefore, "timeline rows must not be mutated");
});

// ---------------------------------------------------------------------------
// Eligibility with mixed known/unknown evidence
// ---------------------------------------------------------------------------

test("13. position-level tenure satisfied but rank tenure unknown -> still Unknown overall (mandatory rank evidence outranks a satisfied level requirement)", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      // Position level (รองสารวัตร) started 2557, well past 7 years. Rank
      // (ร.ต.ท.) has NO matching timeline row at all.
      timeline: [baseTimelineRow("ร.ต.ต.", { yearBE: 2557, year: "2557" })],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.confidence, "incomplete");
  assert.equal(result.promotionIntelligence.promotionStatus, "Unknown");
});

test("14. both position-level and rank tenure confirmed with real evidence -> confidence is confirmed, not incomplete/unknown", () => {
  const result = toQueryOfficer(
    officer({ rank: "ร.ต.ท.", timeline: [baseTimelineRow("ร.ต.ท.", { yearBE: 2557, year: "2557" })] }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.confidence, "confirmed");
});

test("15. existing รอง สว. -> สารวัตร 7-year fixture still returns first eligible year 2574 (Phase 49.7 regression, unaffected by the confidence model)", () => {
  const result = toQueryOfficer(
    officer({
      rank: "ร.ต.ท.",
      timeline: [
        timelineRow({
          id: 1,
          sequence: 0,
          yearBE: 2567,
          year: "2567",
          appointmentCycle: 2567,
          position: "รอง ผบ.ร้อย ตชด.414",
          positionLevel: "รองสารวัตร",
          rank: "ร.ต.ท.",
          unit: "ร้อย ตชด.414",
          isPresent: true,
        }),
      ],
    }),
    ASOF,
    ORG_LABELS,
    null
  );
  assert.equal(result.promotionIntelligence.firstEligibleFiscalYearBe, 2574);
});
