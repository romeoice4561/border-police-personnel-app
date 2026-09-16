/**
 * Create Case — Arrest Information step (Phase DI-1 Round 2, Section 7;
 * DI-7.1: Thai UX guidance throughout — placeholders, helper text, examples).
 *
 * BPP cascade uses the user-supplied unit master (บก.ตชด.ภาค → กก.ตชด. →
 * ร้อย ตชด.) and maps onto existing org ids when they already exist.
 * "หน่วยอื่น / ไม่พบหน่วย" remains the escape hatch and never creates org rows.
 */
"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { ThaiTimePicker } from "@/components/ui/thai_time_picker";
import { BppUnitCascadePicker } from "@/components/drug_intelligence/bpp_unit_cascade_picker";
import { CreateCaseOrgSourcePicker } from "@/components/drug_intelligence/create_case_org_source_picker";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { CreateCaseDraft, ValidationError } from "@/lib/drug_intelligence/create_case_draft";
import type { BppOrgSelection } from "@/lib/drug_intelligence/resolve_bpp_org_selection";
import { leadUnitDisplayText, patchForOurArrestRole, reportingUnitDisplayText } from "@/lib/drug_intelligence/our_arrest_role";
import { cn } from "@/lib/ui/cn";

export function CreateCaseArrestStep({
  draft,
  onChange,
  organizationEngine,
  errors = [],
}: {
  draft: CreateCaseDraft;
  onChange: (patch: Partial<CreateCaseDraft>) => void;
  organizationEngine: OrganizationEngine | undefined;
  errors?: ValidationError[];
}) {
  const { t } = useT();
  const statusOptions = DRUG_CASE_STATUSES.map((s) => ({ value: s, label: t(`di.status.${s}`) }));
  const caseNumberError = errors.find((e) => e.field === "caseNumber")?.message;
  const titleError = errors.find((e) => e.field === "title")?.message;

  function applyReportingUnit(v: BppOrgSelection) {
    onChange({
      headquartersId: v.headquartersId,
      headquartersText: v.headquartersText,
      regionId: v.regionId,
      regionText: v.regionText,
      battalionId: v.battalionId,
      battalionText: v.battalionText,
      companyId: v.companyId,
      companyText: v.companyText,
    });
  }

  function applyLeadSource(next: { useManual: boolean; manualText: string; bpp: BppOrgSelection }) {
    onChange({
      useLeadManualUnit: next.useManual,
      leadManualUnitText: next.manualText,
      leadHeadquartersId: next.bpp.headquartersId,
      leadHeadquartersText: next.bpp.headquartersText,
      leadRegionId: next.bpp.regionId,
      leadRegionText: next.bpp.regionText,
      leadBattalionId: next.bpp.battalionId,
      leadBattalionText: next.bpp.battalionText,
      leadCompanyId: next.bpp.companyId,
      leadCompanyText: next.bpp.companyText,
    });
  }

  const reportingLabel = reportingUnitDisplayText(draft) ?? t("di.ourRole.notSelected");
  const leadLabel = leadUnitDisplayText(draft) ?? t("di.ourRole.notSelected");

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("di.field.caseNumber")} required htmlFor="di-caseNumber" error={caseNumberError}>
            <input
              id="di-caseNumber"
              className={inputCls}
              value={draft.caseNumber}
              onChange={(e) => onChange({ caseNumber: e.target.value })}
              placeholder={t("di.hint.caseNumber")}
              aria-invalid={caseNumberError ? true : undefined}
            />
            <HelperText>{t("di.hint.caseNumberHelper")}</HelperText>
          </Field>
          <Field label={t("di.field.title")} required htmlFor="di-title" error={titleError}>
            <input
              id="di-title"
              className={inputCls}
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={t("di.hint.title")}
              aria-invalid={titleError ? true : undefined}
            />
          </Field>
          <Field label={t("di.field.arrestDate")}>
            <ThaiDatePicker value={draft.arrestDate} onChange={(v) => onChange({ arrestDate: v })} placeholder="DD/MM/YYYY" rejectFuture />
          </Field>
          <Field label={t("di.field.arrestTime")} htmlFor="di-arrestTime">
            <ThaiTimePicker id="di-arrestTime" value={draft.arrestTime} onChange={(v) => onChange({ arrestTime: v })} aria-label={t("di.field.arrestTime")} />
          </Field>
          <Field label={t("di.field.status")}>
            <Select options={statusOptions} value={draft.status} onChange={(e) => onChange({ status: e.target.value })} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{t("di.investigator.sectionLabel")}</p>
            <p className="text-xs text-muted">{t("di.investigator.sectionHelper")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("di.investigator.name")} htmlFor="di-investigatorName">
              <input
                id="di-investigatorName"
                className={inputCls}
                value={draft.investigatorName}
                onChange={(e) => onChange({ investigatorName: e.target.value })}
                placeholder={t("di.investigator.namePlaceholder")}
              />
            </Field>
            <Field label={t("di.investigator.phone")} htmlFor="di-investigatorPhone">
              <input
                id="di-investigatorPhone"
                className={inputCls}
                value={draft.investigatorPhone}
                onChange={(e) => onChange({ investigatorPhone: e.target.value })}
                placeholder={t("di.investigator.phonePlaceholder")}
                inputMode="tel"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{t("di.field.reportingUnit")}</p>
            <p className="text-xs text-muted">{t("di.reportingUnit.helper")}</p>
          </div>

          {!draft.useManualUnit ? (
            <>
              <BppUnitCascadePicker
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
                onChange={applyReportingUnit}
              />
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

      <Card className="border-accent/30">
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{t("di.ourRole.sectionLabel")}</p>
            <p className="text-xs text-muted">{t("di.ourRole.sectionHelper")}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange(patchForOurArrestRole("LEAD"))}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                draft.ourArrestRole === "LEAD" ? "border-accent bg-accent/10" : "border-border bg-background hover:bg-surface"
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{t("di.ourRole.leadTitle")}</span>
              <span className="mt-1 block text-xs text-muted">{t("di.ourRole.leadCopy")}</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(patchForOurArrestRole("SUPPORTING"))}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                draft.ourArrestRole === "SUPPORTING" ? "border-accent bg-accent/10" : "border-border bg-background hover:bg-surface"
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{t("di.ourRole.supportingTitle")}</span>
              <span className="mt-1 block text-xs text-muted">{t("di.ourRole.supportingCopy")}</span>
            </button>
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <p className="text-foreground">
              <span className="text-muted">{t("di.ourRole.summaryReporting")}: </span>
              {reportingLabel}
            </p>
            <p className="text-foreground">
              <span className="text-muted">{t("di.ourRole.summaryLead")}: </span>
              {leadLabel}
            </p>
          </div>

          {draft.ourArrestRole === "LEAD" ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">{t("di.arrestUnit.sectionLabel")}</p>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draft.sameAsReportingUnit}
                  onChange={(e) => onChange({ sameAsReportingUnit: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <span>
                  {t("di.arrestUnit.sameAsReporting")}
                  <span className="mt-0.5 block text-xs text-muted">{t("di.arrestUnit.sameAsReportingHelper")}</span>
                </span>
              </label>
              {draft.sameAsReportingUnit ? <p className="text-xs text-muted">{t("di.ourRole.reportingEqualsLead")}</p> : null}
              {!draft.sameAsReportingUnit ? (
                <CreateCaseOrgSourcePicker
                  organizationEngine={organizationEngine}
                  value={{
                    useManual: draft.useLeadManualUnit,
                    manualText: draft.leadManualUnitText,
                    bpp: {
                      headquartersId: draft.leadHeadquartersId,
                      headquartersText: draft.leadHeadquartersText,
                      regionId: draft.leadRegionId,
                      regionText: draft.leadRegionText,
                      battalionId: draft.leadBattalionId,
                      battalionText: draft.leadBattalionText,
                      companyId: draft.leadCompanyId,
                      companyText: draft.leadCompanyText,
                    },
                  }}
                  onChange={applyLeadSource}
                />
              ) : null}
            </div>
          ) : null}

          {draft.ourArrestRole === "SUPPORTING" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{t("di.ourRole.askLeadUnit")}</p>
                <p className="text-xs text-muted">{t("di.ourRole.supportingDoesNotOverwrite")}</p>
              </div>
              <CreateCaseOrgSourcePicker
                organizationEngine={organizationEngine}
                value={{
                  useManual: draft.useLeadManualUnit,
                  manualText: draft.leadManualUnitText,
                  bpp: {
                    headquartersId: draft.leadHeadquartersId,
                    headquartersText: draft.leadHeadquartersText,
                    regionId: draft.leadRegionId,
                    regionText: draft.leadRegionText,
                    battalionId: draft.leadBattalionId,
                    battalionText: draft.leadBattalionText,
                    companyId: draft.leadCompanyId,
                    companyText: draft.leadCompanyText,
                  },
                }}
                onChange={applyLeadSource}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

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
