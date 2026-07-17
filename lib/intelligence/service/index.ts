/**
 * Service (Years of Service) Engine — public Intelligence API (Phase 40A
 * foundation).
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
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import type { OfficerWithRelations } from "@/lib/database/query_types";
import { calculateCareerYearsSimple } from "@/lib/officer_profile/career_calculator";
import { calculateGovernmentServiceDuration } from "@/lib/personnel_calendar";
import { firstServiceLikeDate, startedAtForMatchingTimeline } from "@/lib/intelligence/shared/timeline_dates";
import { yearsFromDuration, yearsSince } from "@/lib/intelligence/shared/duration";
import type { ServiceSummary } from "@/lib/intelligence/shared/types";

export { firstServiceLikeDate, startedAtForMatchingTimeline };
export { yearsFromDuration, yearsSince };

/**
 * Composes an officer's full service summary: career years (simple,
 * yearBE-based — matches the existing Career Section display), years in
 * current rank, years in current position (by position TEXT match — same
 * heuristic commander_query_service.ts already uses), and years of
 * government service (from the earliest Timeline row).
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
  const governmentServiceYears = yearsFromDuration(calculateGovernmentServiceDuration(serviceStart, asOf));

  return {
    available: true,
    careerYears,
    yearsInRank,
    yearsInPosition,
    yearsInPositionLevel: null,
    governmentServiceYears,
  };
}
