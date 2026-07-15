/**
 * PromotionEligibilityFilter (Phase 41 Part 2–3).
 *
 * The "Promotion Eligibility Search" controls: Current Rank → Target Rank,
 * Current Position Level → Target Position Level, an Eligibility Status filter,
 * and the Completed-years duration filter (Part 3: Completed {0,1,2,3,4,5+} ×
 * operator {Exactly, At least, More than, Less than}) bound to
 * yearsInPositionLevel. Pure controlled component over CommanderQueryFilters —
 * no matching logic here (that lives in the query center's applyFilters).
 */
"use client";

import type { CommanderQueryOptions, NumericOperator } from "@/lib/commander_query/types";
import type { CommanderQueryFilters, NumericFilter } from "@/components/commander/query/types";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";
import { RANKED_POSITION_LEVELS } from "@/lib/commander_query/position_level";
import { COMMANDER_LABELS } from "@/lib/i18n/labels";

const controlClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const DURATION_OPTIONS = [0, 1, 2, 3, 4, 5] as const; // 5 renders as "5+"
const DURATION_OPERATORS: Array<{ value: NumericOperator; key: keyof typeof COMMANDER_LABELS }> = [
  { value: "exactly", key: "operatorExactly" },
  { value: "at_least", key: "operatorAtLeast" },
  { value: "more_than", key: "operatorMoreThan" },
  { value: "less_than", key: "operatorLessThan" },
];

const ELIGIBILITY_STATUSES: Array<{ value: EligibilityStatus; key: keyof typeof COMMANDER_LABELS }> = [
  { value: "eligible_now", key: "eligibleNow" },
  { value: "eligible_soon", key: "eligibleSoon" },
  { value: "overdue", key: "overdue" },
  { value: "not_eligible", key: "notEligible" },
];

const PROMOTION_CYCLE_BUCKETS: Array<{ value: NonNullable<CommanderQueryFilters["promotionCycleBucket"]>; label: string }> = [
  { value: "eligible_this_cycle", label: "Eligible this cycle" },
  { value: "eligible_year_1", label: "Eligible Year 1" },
  { value: "eligible_year_2", label: "Eligible Year 2" },
  { value: "eligible_year_3", label: "Eligible Year 3" },
  { value: "eligible_year_4", label: "Eligible Year 4" },
  { value: "eligible_more_than_5", label: "Eligible more than 5 years" },
];

/** Bilingual "ไทย / English" for a label key (both languages visible this phase — the toggle is a placeholder). */
function bi(key: keyof typeof COMMANDER_LABELS): string {
  const l = COMMANDER_LABELS[key];
  return `${l.th} / ${l.en}`;
}

export function PromotionEligibilityFilter({
  options,
  value,
  onChange,
}: {
  options: CommanderQueryOptions;
  value: CommanderQueryFilters;
  onChange: (next: CommanderQueryFilters) => void;
}) {
  function set<K extends keyof CommanderQueryFilters>(key: K, next: CommanderQueryFilters[K]) {
    onChange({ ...value, [key]: next });
  }

  const duration = value.completedPromotionCycles ?? value.yearsInPositionLevel;

  return (
    <div className="space-y-4">
      {/* Current Rank → Target Rank */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted">
          {bi("currentRank")}
          <select className={controlClass} value={value.fromRank ?? ""} onChange={(e) => set("fromRank", e.target.value || undefined)}>
            <option value="">{bi("allRanks")}</option>
            {options.ranks.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted">
          {bi("targetRank")}
          <select className={controlClass} value={value.toRank ?? ""} onChange={(e) => set("toRank", e.target.value || undefined)}>
            <option value="">{bi("allRanks")}</option>
            {options.ranks.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Current Position Level → Target Position Level */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted">
          {bi("currentPositionLevel")}
          <select className={controlClass} value={value.fromPositionLevel ?? ""} onChange={(e) => set("fromPositionLevel", e.target.value || undefined)}>
            <option value="">{bi("allPositionLevels")}</option>
            {RANKED_POSITION_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted">
          {bi("targetPositionLevel")}
          <select className={controlClass} value={value.toPositionLevel ?? ""} onChange={(e) => set("toPositionLevel", e.target.value || undefined)}>
            <option value="">{bi("allPositionLevels")}</option>
            {RANKED_POSITION_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Eligibility status */}
      <label className="space-y-1 text-xs font-medium text-muted">
        {bi("eligibilityStatus")}
        <select
          className={controlClass}
          value={value.eligibilityStatus ?? ""}
          onChange={(e) => set("eligibilityStatus", (e.target.value || undefined) as EligibilityStatus | undefined)}
        >
          <option value="">{bi("anyStatus")}</option>
          {ELIGIBILITY_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{bi(status.key)}</option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted">
        Promotion Cycle
        <select
          className={controlClass}
          value={value.promotionCycleBucket ?? ""}
          onChange={(e) => set("promotionCycleBucket", (e.target.value || undefined) as CommanderQueryFilters["promotionCycleBucket"])}
        >
          <option value="">Any cycle</option>
          {PROMOTION_CYCLE_BUCKETS.map((bucket) => (
            <option key={bucket.value} value={bucket.value}>{bucket.label}</option>
          ))}
        </select>
      </label>

      {/* Duration filter: Completed {0..5+} × operator */}
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-muted">
          {bi("completed")} — วาระ / Cycles
        </legend>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <select
            className={controlClass}
            aria-label={bi("operatorAtLeast")}
            value={duration?.operator ?? "at_least"}
            onChange={(e) =>
              set("completedPromotionCycles", { operator: e.target.value as NumericOperator, value: duration?.value ?? 0 } satisfies NumericFilter)
            }
          >
            {DURATION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{bi(op.key)}</option>
            ))}
          </select>
          <select
            className={controlClass}
            aria-label={bi("completed")}
            value={duration ? String(duration.value) : ""}
            onChange={(e) =>
              set(
                "completedPromotionCycles",
                e.target.value === "" ? undefined : { operator: duration?.operator ?? "at_least", value: Number(e.target.value) }
              )
            }
          >
            <option value="">—</option>
            {DURATION_OPTIONS.map((cycles) => (
              <option key={cycles} value={cycles}>
                {cycles === 5 ? "5+" : cycles} วาระ
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </div>
  );
}
