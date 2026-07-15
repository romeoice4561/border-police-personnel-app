/**
 * CommanderEligibilityCards (Phase 41 Part 4).
 *
 * One clickable summary card per configured target level ("ครบขึ้น สารวัตร",
 * "ครบขึ้น รองผู้กำกับการ", …) showing how many of the CURRENTLY-FILTERED
 * officers are eligible-now (or overdue) to advance into that level. Clicking a
 * card applies the matching filter (toPositionLevel + eligible-now) to the
 * results table — the same filter fields the manual builder and presets use,
 * so drill-down is just a filter change (no separate code path).
 *
 * Reads the precomputed `nextLevelEligibility` on each officer — no business
 * logic here.
 */
"use client";

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderQueryFilters } from "@/components/commander/query/types";
import { PROMOTION_TARGET_LEVELS } from "@/lib/promotion/eligibility_policy";
import { Card, CardBody } from "@/components/ui/card";

function eligibleCountForLevel(officers: readonly CommanderQueryOfficer[], level: string): number {
  return officers.reduce((count, officer) => {
    const e = officer.nextLevelEligibility;
    if (e && e.targetLevel === level && e.eligibleNow) return count + 1;
    return count;
  }, 0);
}

export function CommanderEligibilityCards({
  officers,
  activeLevel,
  onSelect,
}: {
  officers: CommanderQueryOfficer[];
  activeLevel?: string;
  onSelect: (filters: CommanderQueryFilters, label: string) => void;
}) {
  return (
    <section aria-label="ครบขึ้นระดับตำแหน่ง / Ready for promotion by level">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        ครบขึ้นระดับตำแหน่ง / Ready for promotion
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {PROMOTION_TARGET_LEVELS.map((level) => {
          const count = eligibleCountForLevel(officers, level);
          const isActive = activeLevel === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                onSelect(
                  { toPositionLevel: level, readyForPromotion: true },
                  `ครบขึ้น ${level}`
                )
              }
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
            >
              <Card className={`h-full transition-colors ${isActive ? "border-accent bg-accent/5" : "hover:border-accent"}`}>
                <CardBody className="space-y-1">
                  <p className="text-xs font-medium text-muted">ครบขึ้น</p>
                  <p className="wrap-break-word text-sm font-semibold text-foreground">{level}</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{count.toLocaleString()}</p>
                </CardBody>
              </Card>
            </button>
          );
        })}
      </div>
    </section>
  );
}
