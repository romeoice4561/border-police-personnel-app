import type { CommanderQueryOptions, NumericOperator } from "@/lib/commander_query/types";
import type { CommanderQueryFilters, NumericFilter } from "@/components/commander/query/types";
import { PromotionEligibilityFilter } from "@/components/commander/filters/promotion_eligibility_filter";
import { COMMANDER_LABELS } from "@/lib/i18n/labels";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const controlClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** Bilingual "ไทย / English" for a label key (both languages visible this phase). */
function bi(key: keyof typeof COMMANDER_LABELS): string {
  const l = COMMANDER_LABELS[key];
  return `${l.th} / ${l.en}`;
}

const NUMERIC_OPERATORS: Array<{ value: NumericOperator; label: string }> = [
  { value: "exactly", label: "Exactly" },
  { value: "at_least", label: "At least" },
  { value: "more_than", label: "More than" },
  { value: "less_than", label: "Less than" },
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
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <select
          className={controlClass}
          value={value?.operator ?? "at_least"}
          onChange={(e) => onChange({ operator: e.target.value as NumericOperator, value: value?.value ?? 0 })}
        >
          {NUMERIC_OPERATORS.map((operator) => (
            <option key={operator.value} value={operator.value}>{operator.label}</option>
          ))}
        </select>
        <input
          className={controlClass}
          type="number"
          min="0"
          value={value?.value ?? ""}
          placeholder="Years"
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
  const battalions = options.battalions.filter((item) => value.regionId == null || item.regionId === value.regionId);
  const companies = options.companies.filter((item) => value.battalionId == null || item.battalionId === value.battalionId);

  function set<K extends keyof CommanderQueryFilters>(key: K, next: CommanderQueryFilters[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{mode === "promotion" ? bi("promotionEligibilitySearch") : bi("personnelQuery")}</CardTitle>
        </div>
        {/* Search mode switch (Part 2). */}
        <div role="tablist" aria-label="โหมดค้นหา / Search mode" className="inline-flex overflow-hidden rounded-lg border border-border text-xs font-medium">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "personnel"}
            onClick={() => onModeChange("personnel")}
            className={mode === "personnel" ? "bg-accent px-3 py-1.5 text-white" : "px-3 py-1.5 text-muted hover:text-foreground"}
          >
            {bi("personnelQuery")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "promotion"}
            onClick={() => onModeChange("promotion")}
            className={mode === "promotion" ? "bg-accent px-3 py-1.5 text-white" : "px-3 py-1.5 text-muted hover:text-foreground"}
          >
            {bi("promotionEligibilitySearch")}
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
          <Button type="button" size="sm" onClick={onApply}>{bi("apply")}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>{bi("clearFilters")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={onResetAll}>{bi("resetAll")}</Button>
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
  return (
    <div className="space-y-4">
        <label className="space-y-1 text-xs font-medium text-muted">
          Rank
          <select className={controlClass} value={value.rank ?? ""} onChange={(e) => set("rank", e.target.value || undefined)}>
            <option value="">All ranks</option>
            {options.ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          Current Position
          <input className={controlClass} value={value.currentPosition ?? ""} onChange={(e) => set("currentPosition", e.target.value || undefined)} placeholder="เช่น รองผู้กำกับ" />
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          Position Level
          <select className={controlClass} value={value.positionLevel ?? ""} onChange={(e) => set("positionLevel", e.target.value || undefined)}>
            <option value="">All position levels</option>
            {options.positionLevels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <label className="space-y-1 text-xs font-medium text-muted">
            Region
            <select
              className={controlClass}
              value={value.regionId ?? ""}
              onChange={(e) => onChange({ ...value, regionId: e.target.value ? Number(e.target.value) : undefined, battalionId: undefined, companyId: undefined })}
            >
              <option value="">All regions</option>
              {options.regions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            Battalion
            <select
              className={controlClass}
              value={value.battalionId ?? ""}
              onChange={(e) => onChange({ ...value, battalionId: e.target.value ? Number(e.target.value) : undefined, companyId: undefined })}
            >
              <option value="">All battalions</option>
              {battalions.map((battalion) => <option key={battalion.id} value={battalion.id}>{battalion.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            Company
            <select className={controlClass} value={value.companyId ?? ""} onChange={(e) => set("companyId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">All companies</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
            </select>
          </label>
        </div>

        <NumericFilterControl label="Years in Rank" value={value.yearsInRank} onChange={(next) => set("yearsInRank", next)} />
        <NumericFilterControl label="Years in Position" value={value.yearsInPosition} onChange={(next) => set("yearsInPosition", next)} />
        <NumericFilterControl label={bi("yearsInPositionLevel")} value={value.yearsInPositionLevel} onChange={(next) => set("yearsInPositionLevel", next)} />
        <NumericFilterControl label="Age" value={value.age} onChange={(next) => set("age", next)} />
        <NumericFilterControl label="Government Service Years" value={value.governmentServiceYears} onChange={(next) => set("governmentServiceYears", next)} />

        <label className="space-y-1 text-xs font-medium text-muted">
          Intelligence Flag
          <select className={controlClass} value={value.flagCode ?? ""} onChange={(e) => set("flagCode", e.target.value as CommanderQueryFilters["flagCode"] || undefined)}>
            <option value="">Any flag</option>
            <option value="PROMOTION_READY">Promotion Ready</option>
            <option value="RETIRING_SOON">Retiring Soon</option>
            <option value="DOCUMENTS_MISSING">Missing Documents</option>
            <option value="MISSING_OFFICIAL_PORTRAIT">Missing Portrait</option>
            <option value="NEEDS_TRAINING">Missing Training</option>
            <option value="PROFILE_INCOMPLETE">Profile Incomplete</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          Priority
          <select className={controlClass} value={value.priority ?? ""} onChange={(e) => set("priority", e.target.value as CommanderQueryFilters["priority"] || undefined)}>
            <option value="">Any priority</option>
            {options.priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-muted">
          Minimum Profile Completeness
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
    </div>
  );
}
