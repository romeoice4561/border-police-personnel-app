/**
 * Tests for the pure timeline sorting/grouping helpers (Phase DI-7,
 * Section 5, 18). No database — fixtures built directly against
 * DrugTimelineEvent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { sortDrugTimelineEvents, groupDrugTimelineEvents, filterDrugTimelineEventsForPerson } from "@/lib/drug_intelligence/drug_timeline_grouping";
import type { DrugTimelineEvent } from "@/lib/drug_intelligence/drug_timeline_types";

function event(overrides: Partial<DrugTimelineEvent> = {}): DrugTimelineEvent {
  return {
    caseId: "case-1",
    caseNumber: "QA-001",
    title: "ทดสอบ",
    status: "OPEN",
    arrestDate: new Date("2026-08-01"),
    province: "ชุมพร",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    hasCoordinates: false,
    reportingUnitText: null,
    personCount: 1,
    persons: [{ personId: "p1", primaryFullName: "นาย เอ", role: "SUSPECT" }],
    phoneCount: 0,
    simCount: 0,
    deviceCount: 0,
    vehicleCount: 0,
    seizedItemCount: 0,
    seizedItemsSummary: "",
    hasUnreviewedAlert: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Chronological ordering (Section 5, 18)

test("OLDEST_FIRST sorts ascending by arrestDate", () => {
  const events = [event({ caseId: "c3", arrestDate: new Date("2026-08-10") }), event({ caseId: "c1", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", arrestDate: new Date("2026-08-05") })];
  const sorted = sortDrugTimelineEvents(events, "OLDEST_FIRST");
  assert.deepEqual(sorted.map((e) => e.caseId), ["c1", "c2", "c3"]);
});

test("NEWEST_FIRST sorts descending by arrestDate", () => {
  const events = [event({ caseId: "c1", arrestDate: new Date("2026-08-01") }), event({ caseId: "c3", arrestDate: new Date("2026-08-10") }), event({ caseId: "c2", arrestDate: new Date("2026-08-05") })];
  const sorted = sortDrugTimelineEvents(events, "NEWEST_FIRST");
  assert.deepEqual(sorted.map((e) => e.caseId), ["c3", "c2", "c1"]);
});

test("events with a null arrestDate always sort LAST regardless of direction — never guessed into a position", () => {
  const events = [event({ caseId: "known", arrestDate: new Date("2026-08-01") }), event({ caseId: "unknown", arrestDate: null, caseNumber: "QA-UNK" })];
  const oldest = sortDrugTimelineEvents(events, "OLDEST_FIRST");
  const newest = sortDrugTimelineEvents(events, "NEWEST_FIRST");
  assert.equal(oldest[oldest.length - 1].caseId, "unknown");
  assert.equal(newest[newest.length - 1].caseId, "unknown");
});

test("ties on the same date are broken deterministically by caseNumber", () => {
  const events = [event({ caseId: "c2", caseNumber: "QA-002", arrestDate: new Date("2026-08-01") }), event({ caseId: "c1", caseNumber: "QA-001", arrestDate: new Date("2026-08-01") })];
  const sorted = sortDrugTimelineEvents(events, "OLDEST_FIRST");
  assert.deepEqual(sorted.map((e) => e.caseNumber), ["QA-001", "QA-002"]);
});

test("sorting never mutates the input array", () => {
  const events = [event({ caseId: "c2", arrestDate: new Date("2026-08-10") }), event({ caseId: "c1", arrestDate: new Date("2026-08-01") })];
  const original = [...events];
  sortDrugTimelineEvents(events, "OLDEST_FIRST");
  assert.deepEqual(events, original);
});

test("sorting is deterministic — repeated calls on the same input produce the same order", () => {
  const events = [event({ caseId: "c3", arrestDate: new Date("2026-08-10") }), event({ caseId: "c1", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", arrestDate: new Date("2026-08-05") })];
  const first = sortDrugTimelineEvents(events, "OLDEST_FIRST").map((e) => e.caseId);
  const second = sortDrugTimelineEvents(events, "OLDEST_FIRST").map((e) => e.caseId);
  assert.deepEqual(first, second);
});

// ---------------------------------------------------------------------
// Grouping modes (Section 5)

test("DAY grouping: two events on the same calendar day fall into ONE group", () => {
  const events = [event({ caseId: "c1", arrestDate: new Date("2026-08-01T08:00:00Z") }), event({ caseId: "c2", arrestDate: new Date("2026-08-01T14:00:00Z") })];
  const groups = groupDrugTimelineEvents(events, "DAY", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].events.length, 2);
});

test("DAY grouping: two events on different days fall into DIFFERENT groups", () => {
  const events = [event({ caseId: "c1", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", arrestDate: new Date("2026-08-02") })];
  const groups = groupDrugTimelineEvents(events, "DAY", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.equal(groups.length, 2);
});

test("MONTH grouping: two events in the same month fall into ONE group even on different days", () => {
  const events = [event({ caseId: "c1", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", arrestDate: new Date("2026-08-28") })];
  const groups = groupDrugTimelineEvents(events, "MONTH", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.equal(groups.length, 1);
});

test("LOCATION grouping: groups by province, using the fallback label for a null province", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร" }), event({ caseId: "c2", province: "ชุมพร" }), event({ caseId: "c3", province: null })];
  const groups = groupDrugTimelineEvents(events, "LOCATION", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.equal(groups.length, 2);
  const chumphonGroup = groups.find((g) => g.groupLabel === "ชุมพร")!;
  assert.equal(chumphonGroup.events.length, 2);
  const unknownGroup = groups.find((g) => g.groupLabel === "ไม่ระบุจังหวัด")!;
  assert.equal(unknownGroup.events.length, 1);
});

test("CASE grouping: one group per case, keyed by caseId", () => {
  const events = [event({ caseId: "c1", caseNumber: "QA-001" }), event({ caseId: "c2", caseNumber: "QA-002" })];
  const groups = groupDrugTimelineEvents(events, "CASE", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.groupLabel).sort(),
    ["QA-001", "QA-002"]
  );
});

test("PERSON grouping: an event with MULTIPLE persons appears under EACH person's group — this is correct movement-history semantics, not a duplication bug", () => {
  const events = [event({ caseId: "c1", persons: [{ personId: "pA", primaryFullName: "นาย เอ", role: "SUSPECT" }, { personId: "pB", primaryFullName: "นาย บี", role: "SUSPECT" }] })];
  const groups = groupDrugTimelineEvents(events, "PERSON", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.equal(groups.length, 2);
  assert.ok(groups.every((g) => g.events.length === 1 && g.events[0].caseId === "c1"));
});

test("group order follows the input events' own order, never a separate alphabetical re-sort", () => {
  const events = [event({ caseId: "c1", province: "ระนอง" }), event({ caseId: "c2", province: "ชุมพร" })];
  const groups = groupDrugTimelineEvents(events, "LOCATION", "ไม่ระบุวันที่", "ไม่ระบุจังหวัด");
  assert.deepEqual(groups.map((g) => g.groupLabel), ["ระนอง", "ชุมพร"]);
});

// ---------------------------------------------------------------------
// Person movement history filter (Section 6)

test("filterDrugTimelineEventsForPerson returns only events that include that person", () => {
  const events = [
    event({ caseId: "c1", persons: [{ personId: "pA", primaryFullName: "นาย เอ", role: "SUSPECT" }] }),
    event({ caseId: "c2", persons: [{ personId: "pB", primaryFullName: "นาย บี", role: "SUSPECT" }] }),
    event({ caseId: "c3", persons: [{ personId: "pA", primaryFullName: "นาย เอ", role: "WITNESS" }, { personId: "pC", primaryFullName: "นาย ซี", role: "SUSPECT" }] }),
  ];
  const result = filterDrugTimelineEventsForPerson(events, "pA");
  assert.deepEqual(
    result.map((e) => e.caseId).sort(),
    ["c1", "c3"]
  );
});

test("filterDrugTimelineEventsForPerson returns an empty array for a person with no events — no false movement claim", () => {
  const events = [event({ caseId: "c1", persons: [{ personId: "pA", primaryFullName: "นาย เอ", role: "SUSPECT" }] })];
  const result = filterDrugTimelineEventsForPerson(events, "pZ-nonexistent");
  assert.deepEqual(result, []);
});
