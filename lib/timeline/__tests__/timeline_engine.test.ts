import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonnelTimeline,
  buildTimelineEvents,
  createTimelineEngine,
  dedupeTimelineEvents,
  filterTimelineEvents,
  sortTimelineEvents,
  summarizeTimeline,
  type TimelineBuilderInput,
  type TimelineEvent,
} from "@/lib/timeline";
import { utcDate } from "@/lib/personnel_calendar";

function baseInput(): TimelineBuilderInput {
  return {
    asOf: utcDate(2026, 7, 14),
    officer: {
      officerId: "off-1",
      displayName: "Officer One",
      rank: "Captain",
      organization: "Company 1",
      createdAt: utcDate(2020, 1, 1),
      dateOfBirth: utcDate(1985, 9, 30),
      governmentServiceStartDate: utcDate(2010, 4, 1),
    },
    career: [
      {
        id: 1,
        date: utcDate(2015, 1, 1),
        rank: "Lieutenant",
        position: "Deputy Inspector",
        unit: "Company 1",
        organization: "Company 1",
      },
      {
        id: 2,
        date: utcDate(2020, 1, 1),
        rank: "Captain",
        position: "Inspector",
        unit: "Company 2",
        organization: "Company 2",
        isPresent: true,
      },
    ],
    promotionResult: {
      eligible: true,
      score: 80,
      maxScore: 100,
      passedRules: [],
      failedRules: [],
      missingRequirements: [],
      warnings: [],
      suggestedNextSteps: [],
    },
    salaryHistory: [
      { fiscalYear: 2026, reviewCycle: "APRIL", stepsAwarded: 1, awardType: "NORMAL" },
      { fiscalYear: 2025, reviewCycle: "OCTOBER", stepsAwarded: 2, awardType: "DOUBLE_STEP" },
    ],
    training: [{ id: 1, title: "Command Course", date: utcDate(2024, 5, 1), expiresAt: utcDate(2027, 5, 1) }],
    awards: [{ id: 1, title: "Merit Award", awardedAt: utcDate(2023, 1, 1), remarks: "Excellent service" }],
    documents: [
      {
        id: 1,
        documentType: "GP7",
        title: "GP7",
        uploadedAt: utcDate(2026, 1, 10),
        updatedAt: utcDate(2026, 2, 1),
        isActive: true,
        expiresAt: utcDate(2028, 1, 1),
      },
    ],
    portraits: [{ id: 1, title: "Official portrait updated", updatedAt: utcDate(2026, 3, 1), isOfficial: true }],
    manualEvents: [{ id: "note-1", date: utcDate(2026, 6, 1), title: "Commander note", category: "manual", source: "commander" }],
    futureEvents: [{ id: "future-1", date: utcDate(2026, 12, 1), title: "Manual future event", category: "system" }],
  };
}

test("builder merges mixed sources into chronological timeline events", () => {
  const timeline = buildPersonnelTimeline(baseInput());

  assert.equal(timeline.officer.officerId, "off-1");
  assert.ok(timeline.events.length > 10);
  assert.equal(timeline.events[0].date.toISOString().slice(0, 10), "2010-04-01");
  assert.ok(timeline.events.some((event) => event.type === "SALARY_STEP"));
  assert.ok(timeline.events.some((event) => event.type === "DOCUMENT_UPLOADED"));
  assert.ok(timeline.events.some((event) => event.type === "RETIREMENT"));
});

test("future and past flags are derived from asOf", () => {
  const events = buildTimelineEvents(baseInput());
  const future = events.filter((event) => event.future);
  const past = events.filter((event) => event.past);

  assert.ok(future.some((event) => event.type === "RETIREMENT"));
  assert.ok(future.some((event) => event.title === "Manual future event"));
  assert.ok(past.some((event) => event.type === "TRAINING"));
});

test("filtering supports category, future-only, source, officer, and organization", () => {
  const events = buildTimelineEvents(baseInput());

  assert.ok(filterTimelineEvents(events, { category: "salary" }).every((event) => event.category === "salary"));
  assert.ok(filterTimelineEvents(events, { futureOnly: true }).every((event) => event.future));
  assert.ok(filterTimelineEvents(events, { source: "document" }).every((event) => event.source === "document"));
  assert.ok(filterTimelineEvents(events, { officerId: "off-1" }).length > 0);
  assert.ok(filterTimelineEvents(events, { organization: "Company 2" }).some((event) => event.type === "POSITION_CHANGE"));
});

test("summary counts core categories", () => {
  const summary = summarizeTimeline(buildTimelineEvents(baseInput()));

  assert.ok(summary.totalEvents > 10);
  assert.ok(summary.upcomingEvents > 0);
  assert.ok(summary.pastEvents > 0);
  assert.ok(summary.promotionEvents > 0);
  assert.ok(summary.trainingEvents > 0);
  assert.ok(summary.salaryEvents > 0);
  assert.ok(summary.documentEvents > 0);
});

test("sorting and duplicate prevention are deterministic", () => {
  const events = buildTimelineEvents(baseInput());
  const duplicate = events[0];
  const deduped = dedupeTimelineEvents([duplicate, duplicate, ...events]);
  const sortedDesc = sortTimelineEvents(deduped, "desc");

  assert.equal(deduped.filter((event) => event.id === duplicate.id).length, 1);
  assert.ok(sortedDesc[0].date.getTime() >= sortedDesc[sortedDesc.length - 1].date.getTime());
});

test("timeline engine facade builds, filters, and summarizes", () => {
  const engine = createTimelineEngine();
  const timeline = engine.build(baseInput());
  const salary = engine.filter(timeline.events, { category: "salary" });
  const summary = engine.summarize(salary);

  assert.equal(timeline.summary.totalEvents, timeline.events.length);
  assert.ok(salary.length > 0);
  assert.equal(summary.salaryEvents, salary.length);
});

test("dedupe keeps first event when duplicate ids are supplied manually", () => {
  const base = buildTimelineEvents(baseInput())[0];
  const replacement: TimelineEvent = { ...base, title: "Replacement" };

  assert.equal(dedupeTimelineEvents([base, replacement])[0].title, base.title);
});
