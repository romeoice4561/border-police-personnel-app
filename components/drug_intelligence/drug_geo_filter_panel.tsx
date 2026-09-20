/**
 * DrugGeoFilterPanel (Phase DI-8 / DI-8.2.1).
 *
 * Compact temporal + geographic filters. Custom time uses shared ThaiTimePicker
 * popover (24h). Missing arrestTime is never implied by UI controls.
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { ThaiDatePicker, THAI_EXPIRY_YEAR_BE_MAX, THAI_EXPIRY_YEAR_BE_MIN } from "@/components/ui/thai_date_picker";
import { ThaiTimePicker } from "@/components/ui/thai_time_picker";
import { OrgHierarchyPicker, type OrgHierarchyValue } from "@/components/officer/org_hierarchy_picker";
import { Field, HelperText } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { DRUG_CASE_STATUSES, DRUG_CASE_STATUS_META } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CATEGORIES, DRUG_CATEGORY_LABELS } from "@/lib/drug_intelligence/drug_seized_item_options";
import {
  ISO_WEEKDAYS,
  ISO_WEEKDAY_SHORT_TH,
  MAP_TIME_BUCKETS,
  resolveMapDatePresetRange,
  type IsoWeekday,
  type MapDatePreset,
  type MapTimeBucketId,
  type MapTimePreset,
} from "@/lib/drug_intelligence/drug_map_temporal";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";

const MAP_YEAR_RANGE = { min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX };

const DATE_PRESETS: Array<{ value: Exclude<MapDatePreset, "CUSTOM">; labelKey: string }> = [
  { value: "TODAY", labelKey: "di.map.datePresetToday" },
  { value: "LAST_7", labelKey: "di.map.datePresetLast7" },
  { value: "LAST_30", labelKey: "di.map.datePresetLast30" },
  { value: "THIS_MONTH", labelKey: "di.map.datePresetThisMonth" },
  { value: "THIS_FISCAL_YEAR", labelKey: "di.map.datePresetFiscalYear" },
];

const TIME_PRESET_BUTTONS: Array<{ value: MapTimePreset; labelKey?: string; labelTh?: string }> = [
  { value: "ALL_DAY", labelKey: "di.map.filterTimeAllDay" },
  ...MAP_TIME_BUCKETS.map((b) => ({ value: b.id as MapTimePreset, labelTh: b.labelTh })),
  { value: "CUSTOM", labelKey: "di.map.filterTimeCustom" },
];

function chipClass(active: boolean): string {
  return active
    ? "rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    : "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
}

export function DrugGeoFilterPanel({
  filters,
  onChange,
  organizationEngine,
}: {
  filters: DrugGeoFilterState;
  onChange: (patch: Partial<DrugGeoFilterState>) => void;
  organizationEngine: OrganizationEngine | undefined;
}) {
  const { t } = useT();

  const statusOptions = [{ value: "", label: t("di.map.filterAny") }, ...DRUG_CASE_STATUSES.map((s) => ({ value: s, label: DRUG_CASE_STATUS_META[s].labelTh }))];
  const categoryOptions = [{ value: "", label: t("di.map.filterAny") }, ...DRUG_CATEGORIES.map((c) => ({ value: c, label: DRUG_CATEGORY_LABELS[c].labelTh }))];

  const rangeInvalid =
    Boolean(filters.dateFrom) &&
    Boolean(filters.dateTo) &&
    /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom) &&
    /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo) &&
    filters.dateFrom > filters.dateTo;

  const overnightCustom =
    filters.timePreset === "CUSTOM" &&
    Boolean(filters.timeFrom) &&
    Boolean(filters.timeTo) &&
    filters.timeFrom > filters.timeTo;

  function handleDatePreset(preset: Exclude<MapDatePreset, "CUSTOM">) {
    const range = resolveMapDatePresetRange(preset);
    onChange({ dateFrom: range.dateFrom, dateTo: range.dateTo });
  }

  function toggleWeekday(day: IsoWeekday) {
    const selected = filters.weekdays.includes(day);
    const next = selected ? filters.weekdays.filter((d) => d !== day) : [...filters.weekdays, day].sort((a, b) => a - b);
    onChange({ weekdays: next as IsoWeekday[] });
  }

  function setTimePreset(preset: MapTimePreset) {
    if (preset === "ALL_DAY") {
      onChange({ timePreset: "ALL_DAY", timeFrom: "", timeTo: "" });
      return;
    }
    if (preset === "CUSTOM") {
      onChange({ timePreset: "CUSTOM" });
      return;
    }
    onChange({ timePreset: preset as MapTimeBucketId, timeFrom: "", timeTo: "" });
  }

  const reportingOrgValue: OrgHierarchyValue = {
    headquartersId: filters.headquartersId,
    headquartersText: filters.headquartersText,
    regionId: filters.regionId,
    regionText: filters.regionText,
    battalionId: filters.battalionId,
    battalionText: filters.battalionText,
    companyId: filters.companyId,
    companyText: filters.companyText,
  };
  const leadOrgValue: OrgHierarchyValue = {
    headquartersId: filters.leadHeadquartersId,
    headquartersText: filters.leadHeadquartersText,
    regionId: filters.leadRegionId,
    regionText: filters.leadRegionText,
    battalionId: filters.leadBattalionId,
    battalionText: filters.leadBattalionText,
    companyId: filters.leadCompanyId,
    companyText: filters.leadCompanyText,
  };

  const weekdaysAll = filters.weekdays.length === 0;

  return (
    <div className="space-y-3 overflow-visible">
      <section className="space-y-2.5 overflow-visible" data-testid="map-temporal-filters" aria-label={t("di.map.filterDateRange")}>
        {/* ROW 1 — date presets */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-semibold text-foreground">{t("di.map.filterDateRange")}</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("di.map.filterDateRange")}>
            {DATE_PRESETS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => handleDatePreset(opt.value)} className={chipClass(false)}>
                {t(opt.labelKey as "di.map.datePresetToday")}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 2 — date range */}
        <div className="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-2" data-testid="map-date-range-filters">
          <Field label={t("di.map.filterDateFrom")} htmlFor="geo-dateFrom">
            <ThaiDatePicker
              id="geo-dateFrom"
              value={filters.dateFrom}
              onChange={(iso) => onChange({ dateFrom: iso })}
              placeholder={t("di.map.filterDatePlaceholder")}
              aria-label={t("di.map.filterDateFrom")}
              aria-invalid={rangeInvalid}
              outputFormat="iso"
              displayFormat="short"
              commitOnBrowse={false}
              showTodayButton
              yearRangeBE={MAP_YEAR_RANGE}
              data-testid="map-filter-date-from"
            />
          </Field>
          <Field label={t("di.map.filterDateTo")} htmlFor="geo-dateTo">
            <ThaiDatePicker
              id="geo-dateTo"
              value={filters.dateTo}
              onChange={(iso) => onChange({ dateTo: iso })}
              placeholder={t("di.map.filterDatePlaceholder")}
              aria-label={t("di.map.filterDateTo")}
              aria-invalid={rangeInvalid}
              outputFormat="iso"
              displayFormat="short"
              commitOnBrowse={false}
              showTodayButton
              yearRangeBE={MAP_YEAR_RANGE}
              data-testid="map-filter-date-to"
            />
          </Field>
        </div>
        {rangeInvalid ? (
          <p className="text-xs text-warning" role="alert" data-testid="map-date-range-invalid">
            {t("di.map.filterDateRangeInvalid")}
          </p>
        ) : null}

        {/* ROW 3 — weekdays */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-semibold text-foreground">{t("di.map.filterWeekdays")}</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("di.map.filterWeekdays")} data-testid="map-weekday-filters">
            <button type="button" onClick={() => onChange({ weekdays: [] })} className={chipClass(weekdaysAll)} aria-pressed={weekdaysAll}>
              {t("di.map.filterWeekdayAll")}
            </button>
            {ISO_WEEKDAYS.map((day) => {
              const active = filters.weekdays.includes(day);
              return (
                <button key={day} type="button" onClick={() => toggleWeekday(day)} className={chipClass(active)} aria-pressed={active} title={ISO_WEEKDAY_SHORT_TH[day]}>
                  {ISO_WEEKDAY_SHORT_TH[day]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ROW 4 — time-of-day presets */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-semibold text-foreground">{t("di.map.filterTimeOfDay")}</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("di.map.filterTimeOfDay")} data-testid="map-time-of-day-filters">
            {TIME_PRESET_BUTTONS.map((opt) => {
              const active = filters.timePreset === opt.value;
              const label = opt.labelKey ? t(opt.labelKey as "di.map.filterTimeAllDay") : (opt.labelTh ?? "");
              return (
                <button key={opt.value} type="button" onClick={() => setTimePreset(opt.value)} className={chipClass(active)} aria-pressed={active}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {filters.timePreset === "CUSTOM" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="map-custom-time-range">
            <Field label={t("di.map.filterTimeFrom")} htmlFor="geo-timeFrom">
              <ThaiTimePicker
                id="geo-timeFrom"
                variant="popover"
                value={filters.timeFrom}
                onChange={(v) => onChange({ timeFrom: v })}
                aria-label={t("di.map.filterTimeFrom")}
                placeholder="--:-- น."
              />
            </Field>
            <Field label={t("di.map.filterTimeTo")} htmlFor="geo-timeTo">
              <ThaiTimePicker
                id="geo-timeTo"
                variant="popover"
                value={filters.timeTo}
                onChange={(v) => onChange({ timeTo: v })}
                aria-label={t("di.map.filterTimeTo")}
                placeholder="--:-- น."
              />
            </Field>
            {overnightCustom ? (
              <p className="text-xs text-muted sm:col-span-2" data-testid="map-overnight-hint">
                {t("di.map.filterTimeOvernightHint")}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("di.map.filterProvince")}>
          <Combobox value={filters.province} onChange={(v) => onChange({ province: v })} suggestions={THAI_PROVINCE_OPTIONS} placeholder={t("di.map.filterAny")} />
        </Field>
        <Field label={t("di.map.filterDistrict")} htmlFor="geo-district">
          <input id="geo-district" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.district} onChange={(e) => onChange({ district: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("di.map.filterStatus")}>
          <Select options={statusOptions} value={filters.status} onChange={(e) => onChange({ status: e.target.value })} />
        </Field>
        <Field label={t("di.map.filterDrugCategory")}>
          <Select options={categoryOptions} value={filters.drugCategory} onChange={(e) => onChange({ drugCategory: e.target.value })} />
        </Field>
      </div>

      {organizationEngine ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.map.filterReportingUnit")}</p>
            <OrgHierarchyPicker
              organizationEngine={organizationEngine}
              value={reportingOrgValue}
              onChange={(v) =>
                onChange({
                  headquartersId: v.headquartersId,
                  headquartersText: v.headquartersText,
                  regionId: v.regionId,
                  regionText: v.regionText,
                  battalionId: v.battalionId,
                  battalionText: v.battalionText,
                  companyId: v.companyId,
                  companyText: v.companyText,
                })
              }
            />
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.map.filterLeadUnit")}</p>
            <OrgHierarchyPicker
              organizationEngine={organizationEngine}
              value={leadOrgValue}
              onChange={(v) =>
                onChange({
                  leadHeadquartersId: v.headquartersId,
                  leadHeadquartersText: v.headquartersText,
                  leadRegionId: v.regionId,
                  leadRegionText: v.regionText,
                  leadBattalionId: v.battalionId,
                  leadBattalionText: v.battalionText,
                  leadCompanyId: v.companyId,
                  leadCompanyText: v.companyText,
                })
              }
            />
          </div>
        </div>
      ) : (
        <HelperText>{t("common.loading")}</HelperText>
      )}
    </div>
  );
}
