/**
 * DrugGeoFilterPanel (Phase DI-8, Section 11/12/13/14).
 *
 * All filters read/write the SAME DrugGeoFilterState the page owns and
 * mirrors into URL search params (Section 29) — this component has no
 * fetch logic of its own, purely a controlled-input surface.
 *
 * Province is the canonical Thai province Combobox (never raw free-text
 * dev-style input — Section 12). Org filters reuse the canonical
 * OrgHierarchyPicker (Section 13) for both the reporting unit and the lead
 * arrest unit, independently. Drug category and status use Thai labels
 * only — no raw enum value is ever rendered (Section 14).
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { OrgHierarchyPicker, type OrgHierarchyValue } from "@/components/officer/org_hierarchy_picker";
import { Field, HelperText } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { DRUG_CASE_STATUSES, DRUG_CASE_STATUS_META } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CATEGORIES, DRUG_CATEGORY_LABELS } from "@/lib/drug_intelligence/drug_seized_item_options";
import { DRUG_GEO_TIME_PERIODS, resolveDrugGeoTimePeriodRange, drugGeoTimePeriodLabel, type DrugGeoTimePeriod } from "@/lib/drug_intelligence/drug_geo_time_period";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";

export function DrugGeoFilterPanel({
  filters,
  onChange,
  organizationEngine,
}: {
  filters: DrugGeoFilterState;
  onChange: (patch: Partial<DrugGeoFilterState>) => void;
  organizationEngine: OrganizationEngine | undefined;
}) {
  const { t, language } = useT();

  const statusOptions = [{ value: "", label: t("di.map.filterAny") }, ...DRUG_CASE_STATUSES.map((s) => ({ value: s, label: DRUG_CASE_STATUS_META[s].labelTh }))];
  const categoryOptions = [{ value: "", label: t("di.map.filterAny") }, ...DRUG_CATEGORIES.map((c) => ({ value: c, label: DRUG_CATEGORY_LABELS[c].labelTh }))];
  // CUSTOM isn't a clickable preset — it's the implicit state whenever the
  // user types their own dateFrom/dateTo below, so only the 4 COMPUTED
  // presets get a button; "กำหนดช่วงเอง" is communicated by the date inputs
  // themselves being directly editable, not by a 5th no-op button.
  const timePeriodOptions = DRUG_GEO_TIME_PERIODS.filter((p): p is Exclude<DrugGeoTimePeriod, "CUSTOM"> => p !== "CUSTOM").map((p) => ({ value: p, label: drugGeoTimePeriodLabel(p, language) }));

  function handleTimePeriodChange(period: Exclude<DrugGeoTimePeriod, "CUSTOM">) {
    const range = resolveDrugGeoTimePeriodRange(period);
    onChange({ dateFrom: range.dateFrom, dateTo: range.dateTo });
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

  return (
    <div className="space-y-4">
      <Field label={t("di.map.filterTimePeriod")}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("di.map.filterTimePeriod")}>
          {timePeriodOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTimePeriodChange(opt.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("di.map.filterDateFrom")} htmlFor="geo-dateFrom">
          <input id="geo-dateFrom" type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
        </Field>
        <Field label={t("di.map.filterDateTo")} htmlFor="geo-dateTo">
          <input id="geo-dateTo" type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
        </Field>
        <Field label={t("di.map.filterProvince")}>
          <Combobox value={filters.province} onChange={(v) => onChange({ province: v })} suggestions={THAI_PROVINCE_OPTIONS} placeholder={t("di.map.filterAny")} />
        </Field>
        <Field label={t("di.map.filterDistrict")} htmlFor="geo-district">
          <input id="geo-district" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.district} onChange={(e) => onChange({ district: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("di.map.filterStatus")}>
          <Select options={statusOptions} value={filters.status} onChange={(e) => onChange({ status: e.target.value })} />
        </Field>
        <Field label={t("di.map.filterDrugCategory")}>
          <Select options={categoryOptions} value={filters.drugCategory} onChange={(e) => onChange({ drugCategory: e.target.value })} />
        </Field>
      </div>

      {organizationEngine ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
