import { compareDates } from "@/lib/personnel_calendar";
import type { TimelineEvent, TimelineFilter } from "@/lib/timeline/types";

function matchesOne<T extends string>(actual: T, expected: T | readonly T[] | undefined): boolean {
  if (!expected) return true;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

export function matchesTimelineFilter(event: TimelineEvent, filter: TimelineFilter): boolean {
  if (filter.startDate && compareDates(event.date, filter.startDate) < 0) return false;
  if (filter.endDate && compareDates(event.date, filter.endDate) > 0) return false;
  if (!matchesOne(event.category, filter.category)) return false;
  if (!matchesOne(event.severity, filter.severity)) return false;
  if (!matchesOne(event.source, filter.source)) return false;
  if (filter.futureOnly && !event.future) return false;
  if (filter.pastOnly && !event.past) return false;
  if (filter.officerId && event.officer.officerId !== filter.officerId) return false;
  if (filter.organization) {
    const haystack = [event.officer.organization, event.metadata?.organization, event.metadata?.unit]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filter.organization.toLowerCase())) return false;
  }
  return true;
}

export function filterTimelineEvents(events: readonly TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  return events.filter((event) => matchesTimelineFilter(event, filter));
}
