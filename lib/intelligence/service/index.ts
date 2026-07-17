/**
 * Service (Years of Service) Engine — public Intelligence API (Phase 40A
 * foundation; Phase 40B strengthens the output per the Data Standardization
 * spec).
 *
 * A facade over lib/officer_profile/career_calculator.ts (career/rank/
 * position years from a Timeline array) plus the shared timeline-date +
 * duration helpers this phase consolidated (lib/intelligence/shared/) — the
 * ONE real duplication the Phase 40A audit found (the same
 * firstServiceLikeDate/yearsFromDuration/yearsSince/startedAtForMatchingTimeline
 * helpers existed verbatim in both lib/server/commander_intelligence_
 * service.ts and lib/server/commander_query_service.ts). Both services now
 * import the shared helpers directly; this module additionally exposes them
 * as one composed ServiceSummary for any future consumer that wants the
 * whole picture in one call instead of assembling it by hand.
 *
 * ---------------------------------------------------------------------
 * Timeline-selection rule for "service start date" (Phase 40B, Task 5)
 * ---------------------------------------------------------------------
 * The Officer schema has NO dedicated serviceStartDate/hireDate column, and
 * the Timeline model has no event-type field distinguishing "first
 * appointment" from a later promotion/transfer (confirmed by the Phase 40B
 * audit — see prisma/schema.prisma's Timeline model). Every Timeline row
 * represents an officer's assignment (position/rank/unit) at some point in
 * their career, so the only trustworthy, non-fabricated service-start
 * candidate is: the EARLIEST dated Timeline row, by whichever row has the
 * lowest effectiveDate (derived from day/month/yearBE via toEffectiveDate;
 * a year-only row is anchored to 1 Jan of that year — see toEffectiveDate's
 * own doc comment). This does NOT special-case "the first row must be a
 * hire/appointment" — it takes whatever the earliest recorded row is,
 * because that is the earliest FACT available. If an officer's true
 * service-start predates their earliest Timeline row (e.g. an
 * incompletely-imported history), that is a data-completeness problem,
 * not something this engine should guess around.
 *
 * When zero Timeline rows have a derivable date, `available: false` with
 * reason NO_TRUSTWORTHY_TIMELINE_ENTRY — never a silent zero-duration.
 *
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import type { OfficerWithRelations } from "@/lib/database/query_types";
import { calculateCareerYearsSimple } from "@/lib/officer_profile/career_calculator";
import { calculateGovernmentServiceDuration } from "@/lib/personnel_calendar";
import { firstServiceLikeDate, startedAtForMatchingTimeline } from "@/lib/intelligence/shared/timeline_dates";
import { yearsFromDuration, yearsSince } from "@/lib/intelligence/shared/duration";
import { formatExactDurationTh } from "@/lib/intelligence/shared/exact_duration";
import type { ServiceSummary } from "@/lib/intelligence/shared/types";

export { firstServiceLikeDate, startedAtForMatchingTimeline };
export { yearsFromDuration, yearsSince };

/** The id of the Timeline row whose effectiveDate equals `serviceStartDate` — for traceability in ServiceSummary.sourceTimelineEntryId. Ties (identical dates) resolve to the lowest `sequence`, matching import order. */
function sourceTimelineEntryIdFor(officer: OfficerWithRelations, serviceStartDate: Date): number | null {
  const candidates = officer.timeline
    .filter((row) => {
      const effective = firstServiceLikeDate({ ...officer, timeline: [row] });
      return effective !== null && effective.getTime() === serviceStartDate.getTime();
    })
    .sort((a, b) => a.sequence - b.sequence);
  return candidates[0]?.id ?? null;
}

/**
 * Composes an officer's full service summary: career years (simple,
 * yearBE-based — matches the existing Career Section display), years in
 * current rank, years in current position (by position TEXT match — same
 * heuristic commander_query_service.ts already uses), exact government
 * service duration (from the earliest qualifying Timeline row — see the
 * timeline-selection rule documented above), and the decimal-years
 * compatibility fields from Phase 40A.
 *
 * `positionLevel`/`yearsInPositionLevel` are intentionally NOT computed here
 * — that calculation depends on position-LEVEL classification
 * (lib/commander_query/position_level.ts), which is a Commander Search
 * concern, not a generic service-years concern. Commander Search continues
 * to compute yearsInPositionLevel itself (unchanged) until a future phase
 * decides whether position-level classification belongs in this engine too.
 */
export function computeServiceSummary(officer: OfficerWithRelations, asOf: Date = new Date()): ServiceSummary {
  const careerYears = calculateCareerYearsSimple(officer.timeline, asOf.getUTCFullYear());

  const rankStartedAt = startedAtForMatchingTimeline(officer.timeline, (row) => row.rank === officer.rank);
  const yearsInRank = yearsSince(rankStartedAt, asOf);

  const positionStartedAt = startedAtForMatchingTimeline(
    officer.timeline,
    (row) => row.position === officer.currentPosition || Boolean(officer.currentPosition && row.position.includes(officer.currentPosition))
  );
  const yearsInPosition = yearsSince(positionStartedAt, asOf);

  const serviceStart = firstServiceLikeDate(officer);

  if (!serviceStart) {
    return {
      available: false,
      reason: "NO_TRUSTWORTHY_TIMELINE_ENTRY",
      careerYears,
      yearsInRank,
      yearsInPosition,
      yearsInPositionLevel: null,
      governmentServiceYears: null,
      serviceStartDate: null,
      sourceTimelineEntryId: null,
      exactServiceDuration: null,
      serviceYears: null,
      displayServiceDurationTh: null,
    };
  }

  const exactServiceDuration = calculateGovernmentServiceDuration(serviceStart, asOf);
  const governmentServiceYears = yearsFromDuration(exactServiceDuration);

  return {
    available: true,
    careerYears,
    yearsInRank,
    yearsInPosition,
    yearsInPositionLevel: null,
    governmentServiceYears,
    serviceStartDate: serviceStart.toISOString().slice(0, 10),
    sourceTimelineEntryId: sourceTimelineEntryIdFor(officer, serviceStart),
    exactServiceDuration,
    serviceYears: governmentServiceYears,
    displayServiceDurationTh: formatExactDurationTh(exactServiceDuration),
  };
}
