import type { TimelineEvent, TimelineSummary } from "@/lib/timeline/types";

export function summarizeTimeline(events: readonly TimelineEvent[]): TimelineSummary {
  return {
    totalEvents: events.length,
    upcomingEvents: events.filter((event) => event.future).length,
    pastEvents: events.filter((event) => event.past).length,
    promotionEvents: events.filter((event) => event.category === "promotion").length,
    trainingEvents: events.filter((event) => event.category === "training").length,
    salaryEvents: events.filter((event) => event.category === "salary").length,
    documentEvents: events.filter((event) => event.category === "document").length,
  };
}
