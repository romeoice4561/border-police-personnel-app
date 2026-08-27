/**
 * Create Case — Arrest Information step (Phase DI-1 Round 2, Section 7;
 * DI-7.1: Thai UX guidance throughout — placeholders, helper text, examples).
 *
 * Org picker reuses the EXISTING OrgHierarchyPicker (legacy Region →
 * Battalion → Company / Headquarters) — never a duplicated free-text unit
 * field, per Section 7's explicit instruction.
 */
"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { OrgHierarchyPicker } from "@/components/officer/org_hierarchy_picker";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { CreateCaseDraft } from "@/lib/drug_intelligence/create_case_draft";

export function CreateCaseArrestStep({
  draft,
  onChange,
  organizationEngine,
}: {
  draft: CreateCaseDraft;
  onChange: (patch: Partial<CreateCaseDraft>) => void;
  organizationEngine: OrganizationEngine | undefined;
}) {
  const { t } = useT();
  const statusOptions = DRUG_CASE_STATUSES.map((s) => ({ value: s, label: t(`di.status.${s}`) }));

  return (
    <div className="space-y-4">
      {/* Case basics */}
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("di.field.caseNumber")} required htmlFor="di-caseNumber">
            <input
              id="di-caseNumber"
              className={inputCls}
              value={draft.caseNumber}
              onChange={(e) => onChange({ caseNumber: e.target.value })}
              placeholder={t("di.hint.caseNumber")}
            />
          </Field>
          <Field label={t("di.field.title")} required htmlFor="di-title">
            <input
              id="di-title"
              className={inputCls}
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={t("di.hint.title")}
            />
          </Field>
          <Field label={t("di.field.arrestDate")}>
            <ThaiDatePicker value={draft.arrestDate} onChange={(v) => onChange({ arrestDate: v })} placeholder="DD/MM/YYYY" rejectFuture />
          </Field>
          <Field label={t("di.field.arrestTime")} htmlFor="di-arrestTime">
            <input id="di-arrestTime" type="time" className={inputCls} value={draft.arrestTime} onChange={(e) => onChange({ arrestTime: e.target.value })} />
          </Field>
          <Field label={t("di.field.status")}>
            <Select options={statusOptions} value={draft.status} onChange={(e) => onChange({ status: e.target.value })} />
          </Field>
        </CardBody>
      </Card>

      {/* Org picker — reuses canonical hierarchy + "หน่วยอื่น / ไม่พบหน่วย" fallback */}
      <Card>
        <CardBody className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.field.reportingUnit")}</p>

          {!draft.useManualUnit ? (
            <>
              {organizationEngine ? (
                <OrgHierarchyPicker
                  organizationEngine={organizationEngine}
                  value={{
                    headquartersId: draft.headquartersId,
                    headquartersText: draft.headquartersText,
                    regionId: draft.regionId,
                    regionText: draft.regionText,
                    battalionId: draft.battalionId,
                    battalionText: draft.battalionText,
                    companyId: draft.companyId,
                    companyText: draft.companyText,
                  }}
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
              ) : (
                <p className="text-sm text-muted">{t("common.loading")}</p>
              )}
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() =>
                  onChange({
                    useManualUnit: true,
                    headquartersId: null,
                    regionId: null,
                    battalionId: null,
                    companyId: null,
                  })
                }
              >
                {t("di.org.fallbackOption")}
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                <span>{t("di.org.manualLabel")}</span>
                <button
                  type="button"
                  className="ml-auto text-xs text-accent hover:underline"
                  onClick={() => onChange({ useManualUnit: false, manualUnitText: "" })}
                >
                  {t("di.org.switchToCanonical")}
                </button>
              </div>
              <input
                className={inputCls}
                value={draft.manualUnitText}
                onChange={(e) => onChange({ manualUnitText: e.target.value })}
                placeholder={t("di.hint.orgOther")}
              />
              <HelperText>{t("di.org.manualHelperText")}</HelperText>
            </div>
          )}
        </CardBody>
      </Card>

      {/* DI-7.6 Section 7: Lead Arrest Unit — a DISTINCT concept from the
          reporting unit above (Section 0). "ใช้หน่วยเดียวกับหน่วยรายงาน" copies
          the already-resolved reporting-unit selection rather than requiring
          the operator to pick it twice. */}
      <Card>
        <CardBody className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.arrestUnit.sectionLabel")}</p>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.sameAsReportingUnit}
              onChange={(e) => onChange({ sameAsReportingUnit: e.target.checked })}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            {t("di.arrestUnit.sameAsReporting")}
          </label>

          {!draft.sameAsReportingUnit ? (
            !draft.useLeadManualUnit ? (
              <>
                {organizationEngine ? (
                  <OrgHierarchyPicker
                    organizationEngine={organizationEngine}
                    value={{
                      headquartersId: draft.leadHeadquartersId,
                      headquartersText: draft.leadHeadquartersText,
                      regionId: draft.leadRegionId,
                      regionText: draft.leadRegionText,
                      battalionId: draft.leadBattalionId,
                      battalionText: draft.leadBattalionText,
                      companyId: draft.leadCompanyId,
                      companyText: draft.leadCompanyText,
                    }}
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
                ) : (
                  <p className="text-sm text-muted">{t("common.loading")}</p>
                )}
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() =>
                    onChange({
                      useLeadManualUnit: true,
                      leadHeadquartersId: null,
                      leadRegionId: null,
                      leadBattalionId: null,
                      leadCompanyId: null,
                    })
                  }
                >
                  {t("di.org.fallbackOption")}
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                  <span>{t("di.org.manualLabel")}</span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-accent hover:underline"
                    onClick={() => onChange({ useLeadManualUnit: false, leadManualUnitText: "" })}
                  >
                    {t("di.org.switchToCanonical")}
                  </button>
                </div>
                <input
                  className={inputCls}
                  value={draft.leadManualUnitText}
                  onChange={(e) => onChange({ leadManualUnitText: e.target.value })}
                  placeholder={t("di.hint.orgOther")}
                />
                <HelperText>{t("di.org.manualHelperText")}</HelperText>
              </div>
            )
          ) : null}
        </CardBody>
      </Card>

      {/* Location */}
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("di.field.province")}>
            <Combobox value={draft.province} onChange={(v) => onChange({ province: v })} suggestions={THAI_PROVINCE_OPTIONS} />
          </Field>
          <Field label={t("di.field.district")} htmlFor="di-district">
            <input id="di-district" className={inputCls} value={draft.district} onChange={(e) => onChange({ district: e.target.value })} />
          </Field>
          <Field label={t("di.field.subdistrict")} htmlFor="di-subdistrict">
            <input id="di-subdistrict" className={inputCls} value={draft.subdistrict} onChange={(e) => onChange({ subdistrict: e.target.value })} />
          </Field>
          <Field label={t("di.field.locationName")} htmlFor="di-locationName">
            <input
              id="di-locationName"
              className={inputCls}
              value={draft.locationName}
              onChange={(e) => onChange({ locationName: e.target.value })}
              placeholder={t("di.hint.locationName")}
            />
          </Field>
          <div className="space-y-1">
            <Field label={t("di.field.latitude")} htmlFor="di-latitude">
              <input
                id="di-latitude"
                className={inputCls}
                value={draft.latitude}
                onChange={(e) => onChange({ latitude: e.target.value })}
                inputMode="decimal"
                placeholder={t("di.hint.latitude")}
              />
            </Field>
            <HelperText>{t("di.hint.latitude")}</HelperText>
          </div>
          <div className="space-y-1">
            <Field label={t("di.field.longitude")} htmlFor="di-longitude">
              <input
                id="di-longitude"
                className={inputCls}
                value={draft.longitude}
                onChange={(e) => onChange({ longitude: e.target.value })}
                inputMode="decimal"
                placeholder={t("di.hint.longitude")}
              />
            </Field>
            <HelperText>{t("di.hint.longitude")}</HelperText>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 space-y-0.5 rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted">{t("di.map.coordinateHelperText")}</p>
            <p className="text-xs text-muted">{t("di.map.coordinatePairRule")}</p>
            <p className="text-xs text-muted">{t("di.map.coordinateRangeRule")}</p>
          </div>
        </CardBody>
      </Card>

      {/* Narrative */}
      <Card>
        <CardBody>
          <Field label={t("di.field.narrative")} htmlFor="di-narrative">
            <textarea
              id="di-narrative"
              className={`${inputCls} min-h-28 resize-y`}
              value={draft.narrative}
              onChange={(e) => onChange({ narrative: e.target.value })}
              placeholder={t("di.hint.narrative")}
            />
            <HelperText>{t("di.hint.narrative")}</HelperText>
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}
