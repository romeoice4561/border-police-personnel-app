"use client";

import type { CommanderQueryOptions, NumericOperator } from "@/lib/commander_query/types";
import type { CommanderQueryFilters, NumericFilter } from "@/components/commander/query/types";
import { PromotionEligibilityFilter } from "@/components/commander/filters/promotion_eligibility_filter";
import { SkillFilterControl } from "@/components/commander/filters/skill_filter";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const controlClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const NUMERIC_OPERATOR_KEYS: Array<{ value: NumericOperator; key: TranslationKey }> = [
  { value: "exactly", key: "commander.operatorExactly" },
  { value: "at_least", key: "commander.operatorAtLeast" },
  { value: "more_than", key: "commander.operatorMoreThan" },
  { value: "less_than", key: "commander.operatorLessThan" },
];

function NumericFilterControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: NumericFilter | undefined;
  onChange: (next: NumericFilter | undefined) => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <select
          className={controlClass}
          aria-label={label}
          value={value?.operator ?? "at_least"}
          onChange={(e) => onChange({ operator: e.target.value as NumericOperator, value: value?.value ?? 0 })}
        >
          {NUMERIC_OPERATOR_KEYS.map((operator) => (
            <option key={operator.value} value={operator.value}>{t(operator.key)}</option>
          ))}
        </select>
        <input
          className={controlClass}
          type="number"
          min="0"
          value={value?.value ?? ""}
          placeholder={t("commander.yearsPlaceholder")}
          onChange={(e) => onChange(e.target.value === "" ? undefined : { operator: value?.operator ?? "at_least", value: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

export type QueryMode = "personnel" | "promotion";

export function CommanderQueryBuilder({
  options,
  value,
  mode,
  onModeChange,
  onChange,
  onApply,
  onClearFilters,
  onResetAll,
}: {
  options: CommanderQueryOptions;
  value: CommanderQueryFilters;
  mode: QueryMode;
  onModeChange: (mode: QueryMode) => void;
  onChange: (next: CommanderQueryFilters) => void;
  /** Apply/confirm the current filters. Filtering is live, so this scrolls the results into view (useful on stacked mobile layouts). */
  onApply: () => void;
  /** Clear the filter VALUES (keep mode). */
  onClearFilters: () => void;
  /** Reset EVERYTHING to defaults (filters, drilldown, preset, sort). */
  onResetAll: () => void;
}) {
  const { t } = useT();
  const battalions = options.battalions.filter((item) => value.regionId == null || item.regionId === value.regionId);
  const companies = options.companies.filter((item) => value.battalionId == null || item.battalionId === value.battalionId);

  function set<K extends keyof CommanderQueryFilters>(key: K, next: CommanderQueryFilters[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{mode === "promotion" ? t("commander.promotionEligibilitySearch") : t("commander.personnelQuery")}</CardTitle>
        </div>
        {/* Search mode switch (Part 2). */}
        <div role="tablist" aria-label={t("commander.searchMode")} className="inline-flex overflow-hidden rounded-lg border border-border text-xs font-medium">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "personnel"}
            onClick={() => onModeChange("personnel")}
            className={mode === "personnel" ? "bg-accent px-3 py-1.5 text-white" : "px-3 py-1.5 text-muted hover:text-foreground"}
          >
            {t("commander.personnelQuery")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "promotion"}
            onClick={() => onModeChange("promotion")}
            className={mode === "promotion" ? "bg-accent px-3 py-1.5 text-white" : "px-3 py-1.5 text-muted hover:text-foreground"}
          >
            {t("commander.promotionEligibilitySearch")}
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {mode === "promotion" ? (
          <PromotionEligibilityFilter options={options} value={value} onChange={onChange} />
        ) : (
          <PersonnelFilters
            options={options}
            value={value}
            set={set}
            onChange={onChange}
            battalions={battalions}
            companies={companies}
          />
        )}

        {/* Actions (Part 6): Apply / Reset All / Clear Filters. */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" size="sm" onClick={onApply}>{t("common.apply")}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>{t("common.clearFilters")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={onResetAll}>{t("common.resetAll")}</Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** The original Personnel Query fields, extracted so the builder can swap between them and the Promotion Eligibility panel by mode. */
function PersonnelFilters({
  options,
  value,
  set,
  onChange,
  battalions,
  companies,
}: {
  options: CommanderQueryOptions;
  value: CommanderQueryFilters;
  set: <K extends keyof CommanderQueryFilters>(key: K, next: CommanderQueryFilters[K]) => void;
  onChange: (next: CommanderQueryFilters) => void;
  battalions: CommanderQueryOptions["battalions"];
  companies: CommanderQueryOptions["companies"];
}) {
  const { t } = useT();
  return (
    <div className="space-y-4">
        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.rank")}
          <select className={controlClass} value={value.rank ?? ""} onChange={(e) => set("rank", e.target.value || undefined)}>
            <option value="">{t("commander.allRanks")}</option>
            {options.ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.currentPosition")}
          <input className={controlClass} value={value.currentPosition ?? ""} onChange={(e) => set("currentPosition", e.target.value || undefined)} />
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.positionLevel")}
          <select className={controlClass} value={value.positionLevel ?? ""} onChange={(e) => set("positionLevel", e.target.value || undefined)}>
            <option value="">{t("commander.allPositionLevels")}</option>
            {options.positionLevels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <label className="space-y-1 text-xs font-medium text-muted">
            {t("commander.region")}
            <select
              className={controlClass}
              value={value.regionId ?? ""}
              onChange={(e) => onChange({ ...value, regionId: e.target.value ? Number(e.target.value) : undefined, battalionId: undefined, companyId: undefined })}
            >
              <option value="">{t("commander.allRegions")}</option>
              {options.regions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            {t("commander.battalion")}
            <select
              className={controlClass}
              value={value.battalionId ?? ""}
              onChange={(e) => onChange({ ...value, battalionId: e.target.value ? Number(e.target.value) : undefined, companyId: undefined })}
            >
              <option value="">{t("commander.allBattalions")}</option>
              {battalions.map((battalion) => <option key={battalion.id} value={battalion.id}>{battalion.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            {t("commander.company")}
            <select className={controlClass} value={value.companyId ?? ""} onChange={(e) => set("companyId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">{t("commander.allCompanies")}</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
            </select>
          </label>
        </div>

        <NumericFilterControl label={t("commander.completedPromotionCycles")} value={value.completedPromotionCycles} onChange={(next) => set("completedPromotionCycles", next)} />
        <NumericFilterControl label={t("commander.appointmentCycle")} value={value.appointmentCycle} onChange={(next) => set("appointmentCycle", next)} />
        <NumericFilterControl label={t("commander.age")} value={value.age} onChange={(next) => set("age", next)} />

        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.intelligenceFlag")}
          <select className={controlClass} value={value.flagCode ?? ""} onChange={(e) => set("flagCode", e.target.value as CommanderQueryFilters["flagCode"] || undefined)}>
            <option value="">{t("commander.anyFlag")}</option>
            <option value="PROMOTION_READY">{t("commander.flagPromotionReady")}</option>
            <option value="RETIRING_SOON">{t("commander.flagRetiringSoon")}</option>
            <option value="DOCUMENTS_MISSING">{t("commander.flagDocumentsMissing")}</option>
            <option value="MISSING_OFFICIAL_PORTRAIT">{t("commander.flagMissingPortrait")}</option>
            <option value="NEEDS_TRAINING">{t("commander.flagNeedsTraining")}</option>
            <option value="PROFILE_INCOMPLETE">{t("commander.flagProfileIncomplete")}</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.priority")}
          <select className={controlClass} value={value.priority ?? ""} onChange={(e) => set("priority", e.target.value as CommanderQueryFilters["priority"] || undefined)}>
            <option value="">{t("commander.anyPriority")}</option>
            {options.priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          {t("commander.minProfileCompleteness")}
          <input
            className={controlClass}
            type="number"
            min="0"
            max="100"
            value={value.minProfileCompleteness ?? ""}
            onChange={(e) => set("minProfileCompleteness", e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="0-100"
          />
        </label>

        {/* Phase 44: capability filter. */}
        <SkillFilterControl catalog={options.skillCatalog} value={value.skill} onChange={(next) => set("skill", next)} />
    </div>
  );
}
