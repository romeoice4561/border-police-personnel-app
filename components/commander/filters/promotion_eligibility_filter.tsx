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
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const controlClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const DURATION_OPTIONS = [0, 1, 2, 3, 4, 5] as const; // 5 renders as "5+"
const DURATION_OPERATORS: Array<{ value: NumericOperator; key: TranslationKey }> = [
  { value: "exactly", key: "commander.operatorExactly" },
  { value: "at_least", key: "commander.operatorAtLeast" },
  { value: "more_than", key: "commander.operatorMoreThan" },
  { value: "less_than", key: "commander.operatorLessThan" },
];

const ELIGIBILITY_STATUSES: Array<{ value: EligibilityStatus; key: TranslationKey }> = [
  { value: "eligible_now", key: "commander.eligibleNow" },
  { value: "eligible_soon", key: "commander.eligibleSoon" },
  { value: "overdue", key: "commander.overdue" },
  { value: "not_eligible", key: "commander.notEligible" },
];

const PROMOTION_CYCLE_BUCKETS: Array<{ value: NonNullable<CommanderQueryFilters["promotionCycleBucket"]>; key: TranslationKey }> = [
  { value: "eligible_this_cycle", key: "commander.eligibleThisCycle" },
  { value: "eligible_year_1", key: "commander.eligibleYear1" },
  { value: "eligible_year_2", key: "commander.eligibleYear2" },
  { value: "eligible_year_3", key: "commander.eligibleYear3" },
  { value: "eligible_year_4", key: "commander.eligibleYear4" },
  { value: "eligible_more_than_5", key: "commander.eligibleMoreThan5" },
];

export function PromotionEligibilityFilter({
  options,
  value,
  onChange,
}: {
  options: CommanderQueryOptions;
  value: CommanderQueryFilters;
  onChange: (next: CommanderQueryFilters) => void;
}) {
  const { t } = useT();
  function set<K extends keyof CommanderQueryFilters>(key: K, next: CommanderQueryFilters[K]) {
    onChange({ ...value, [key]: next });
  }

  const duration = value.completedPromotionCycles ?? value.yearsInPositionLevel;

  return (
    <div className="space-y-4">
      {/* Current Rank → Target Rank */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.currentRank")}
          <select className={controlClass} value={value.fromRank ?? ""} onChange={(e) => set("fromRank", e.target.value || undefined)}>
            <option value="">{t("commander.allRanks")}</option>
            {options.ranks.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.targetRank")}
          <select className={controlClass} value={value.toRank ?? ""} onChange={(e) => set("toRank", e.target.value || undefined)}>
            <option value="">{t("commander.allRanks")}</option>
            {options.ranks.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Current Position Level → Target Position Level */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.currentPositionLevel")}
          <select className={controlClass} value={value.fromPositionLevel ?? ""} onChange={(e) => set("fromPositionLevel", e.target.value || undefined)}>
            <option value="">{t("commander.allPositionLevels")}</option>
            {RANKED_POSITION_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.targetPositionLevel")}
          <select className={controlClass} value={value.toPositionLevel ?? ""} onChange={(e) => set("toPositionLevel", e.target.value || undefined)}>
            <option value="">{t("commander.allPositionLevels")}</option>
            {RANKED_POSITION_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Eligibility status */}
      <label className="space-y-1 text-xs font-medium text-muted">
        {t("commander.eligibilityStatus")}
        <select
          className={controlClass}
          value={value.eligibilityStatus ?? ""}
          onChange={(e) => set("eligibilityStatus", (e.target.value || undefined) as EligibilityStatus | undefined)}
        >
          <option value="">{t("commander.anyStatus")}</option>
          {ELIGIBILITY_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{t(status.key)}</option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted">
        {t("commander.promotionCycle")}
        <select
          className={controlClass}
          value={value.promotionCycleBucket ?? ""}
          onChange={(e) => set("promotionCycleBucket", (e.target.value || undefined) as CommanderQueryFilters["promotionCycleBucket"])}
        >
          <option value="">{t("commander.anyCycle")}</option>
          {PROMOTION_CYCLE_BUCKETS.map((bucket) => (
            <option key={bucket.value} value={bucket.value}>{t(bucket.key)}</option>
          ))}
        </select>
      </label>

      {/* Duration filter: Completed {0..5+} × operator */}
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-muted">
          {t("commander.completed")} — {t("commander.cycles")}
        </legend>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <select
            className={controlClass}
            aria-label={t("commander.operatorAtLeast")}
            value={duration?.operator ?? "at_least"}
            onChange={(e) =>
              set("completedPromotionCycles", { operator: e.target.value as NumericOperator, value: duration?.value ?? 0 } satisfies NumericFilter)
            }
          >
            {DURATION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{t(op.key)}</option>
            ))}
          </select>
          <select
            className={controlClass}
            aria-label={t("commander.completed")}
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
                {cycles === 5 ? "5+" : cycles} {t("commander.cycles")}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* Phase 49.7: exact-year filters — canonical fields (positionLevelStartYearBe / firstEligibleFiscalYearBe), no calculation in this component. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.positionLevelStartYear")}
          <input
            type="number"
            inputMode="numeric"
            className={controlClass}
            placeholder={t("commander.yearsPlaceholder")}
            value={value.positionLevelStartYearBe ?? ""}
            onChange={(e) => set("positionLevelStartYearBe", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.firstEligibleYear")}
          <input
            type="number"
            inputMode="numeric"
            className={controlClass}
            placeholder={t("commander.yearsPlaceholder")}
            value={value.firstEligibleYearBe ?? ""}
            onChange={(e) => set("firstEligibleYearBe", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
