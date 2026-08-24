/**
 * Pure timeline grouping/sorting helpers (Phase DI-7, Section 5).
 *
 * No I/O, no Prisma, no React — takes already-hydrated DrugTimelineEvent[]
 * and produces sorted/grouped output. Deterministic: identical input always
 * produces identical output, same convention as drug_network_graph_layout.ts.
 */

import type { DrugTimelineEvent, DrugTimelineGroup, DrugTimelineGroupMode, DrugTimelineSortDirection } from "@/lib/drug_intelligence/drug_timeline_types";

const THAI_MONTH_NAMES = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/**
 * Sorts events by arrestDate. Events with a null arrestDate always sort
 * LAST regardless of direction (Section 5: never guess a date), tie-broken
 * by caseNumber for full determinism. Never mutates the input array.
 */
export function sortDrugTimelineEvents(events: DrugTimelineEvent[], direction: DrugTimelineSortDirection): DrugTimelineEvent[] {
  const withDate = events.filter((e) => e.arrestDate !== null);
  const withoutDate = events.filter((e) => e.arrestDate === null).sort((a, b) => a.caseNumber.localeCompare(b.caseNumber));

  const sorted = [...withDate].sort((a, b) => {
    const diff = a.arrestDate!.getTime() - b.arrestDate!.getTime();
    if (diff !== 0) return direction === "OLDEST_FIRST" ? diff : -diff;
    return a.caseNumber.localeCompare(b.caseNumber);
  });

  return [...sorted, ...withoutDate];
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

function formatThaiBuddhistDate(date: Date): string {
  const day = date.getUTCDate();
  const month = THAI_MONTH_NAMES[date.getUTCMonth()];
  const buddhistYear = date.getUTCFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

function formatThaiBuddhistMonth(date: Date): string {
  const month = THAI_MONTH_NAMES[date.getUTCMonth()];
  const buddhistYear = date.getUTCFullYear() + 543;
  return `${month} ${buddhistYear}`;
}

const NO_DATE_GROUP_KEY = "__no_date__";
const NO_PROVINCE_GROUP_KEY = "__no_province__";

/**
 * Groups an already-sorted event list per the given mode. Group order
 * follows the events' own sort order (first-seen-first), never a separate
 * alphabetical/numeric re-sort of the groups themselves, so switching group
 * mode never contradicts the chronological direction the analyst chose.
 */
export function groupDrugTimelineEvents(events: DrugTimelineEvent[], mode: DrugTimelineGroupMode, noDateLabel: string, noProvinceLabel: string): DrugTimelineGroup[] {
  const groups = new Map<string, DrugTimelineGroup>();

  function pushEvent(key: string, label: string, event: DrugTimelineEvent) {
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
      return;
    }
    groups.set(key, { groupKey: key, groupLabel: label, events: [event] });
  }

  for (const event of events) {
    if (mode === "DAY") {
      if (!event.arrestDate) {
        pushEvent(NO_DATE_GROUP_KEY, noDateLabel, event);
        continue;
      }
      pushEvent(dayKey(event.arrestDate), formatThaiBuddhistDate(event.arrestDate), event);
    } else if (mode === "MONTH") {
      if (!event.arrestDate) {
        pushEvent(NO_DATE_GROUP_KEY, noDateLabel, event);
        continue;
      }
      pushEvent(monthKey(event.arrestDate), formatThaiBuddhistMonth(event.arrestDate), event);
    } else if (mode === "LOCATION") {
      const key = event.province ?? NO_PROVINCE_GROUP_KEY;
      pushEvent(key, event.province ?? noProvinceLabel, event);
    } else if (mode === "CASE") {
      pushEvent(event.caseId, event.caseNumber, event);
    } else if (mode === "PERSON") {
      if (event.persons.length === 0) {
        pushEvent(NO_DATE_GROUP_KEY, noDateLabel, event);
        continue;
      }
      // An event can belong to multiple person-groups (a case with several
      // persons appears once under EACH person) — this is the correct
      // "person movement history" semantic (Section 6), not a bug: the same
      // case genuinely belongs to every person recorded on it.
      for (const p of event.persons) {
        pushEvent(`person:${p.personId}`, p.primaryFullName, event);
      }
    }
  }

  return [...groups.values()];
}

/** Section 6: pure person-movement filter — every event that has this person among its recorded persons, in the caller's chosen sort order. Never claims travel; the caller composes wording separately (drug_timeline_explanation.ts). */
export function filterDrugTimelineEventsForPerson(events: DrugTimelineEvent[], personId: string): DrugTimelineEvent[] {
  return events.filter((e) => e.persons.some((p) => p.personId === personId));
}
