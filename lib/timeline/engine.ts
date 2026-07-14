import { buildPersonnelTimeline, buildTimelineEvents } from "@/lib/timeline/builder";
import { filterTimelineEvents } from "@/lib/timeline/filters";
import { summarizeTimeline } from "@/lib/timeline/summary";
import type { Timeline, TimelineBuilderInput, TimelineEvent, TimelineFilter } from "@/lib/timeline/types";

export class TimelineEngine {
  build(input: TimelineBuilderInput): Timeline {
    return buildPersonnelTimeline(input);
  }

  buildEvents(input: TimelineBuilderInput): TimelineEvent[] {
    return buildTimelineEvents(input);
  }

  filter(events: readonly TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
    return filterTimelineEvents(events, filter);
  }

  summarize(events: readonly TimelineEvent[]) {
    return summarizeTimeline(events);
  }
}

export function createTimelineEngine(): TimelineEngine {
  return new TimelineEngine();
}
