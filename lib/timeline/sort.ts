import { compareDates } from "@/lib/personnel_calendar";
import type { TimelineEvent } from "@/lib/timeline/types";

export type TimelineSortDirection = "asc" | "desc";

export function sortTimelineEvents(
  events: readonly TimelineEvent[],
  direction: TimelineSortDirection = "desc"
): TimelineEvent[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...events].sort((a, b) => {
    const byDate = compareDates(a.date, b.date);
    if (byDate !== 0) return byDate * multiplier;
    return a.id.localeCompare(b.id) * multiplier;
  });
}

export function dedupeTimelineEvents(events: readonly TimelineEvent[]): TimelineEvent[] {
  const seen = new Set<string>();
  const deduped: TimelineEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    deduped.push(event);
  }
  return deduped;
}
