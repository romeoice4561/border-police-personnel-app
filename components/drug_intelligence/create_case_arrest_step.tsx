/**
 * Create Case — Arrest Information step (Phase DI-1 Round 2, Section 7).
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
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
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
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("di.field.caseNumber")} required htmlFor="di-caseNumber">
            <input id="di-caseNumber" className={inputCls} value={draft.caseNumber} onChange={(e) => onChange({ caseNumber: e.target.value })} />
          </Field>
          <Field label={t("di.field.title")} required htmlFor="di-title">
            <input id="di-title" className={inputCls} value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
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

      <Card>
        <CardBody className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.field.reportingUnit")}</p>
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
            <input id="di-locationName" className={inputCls} value={draft.locationName} onChange={(e) => onChange({ locationName: e.target.value })} />
          </Field>
          <Field label={t("di.field.latitude")} htmlFor="di-latitude">
            <input id="di-latitude" className={inputCls} value={draft.latitude} onChange={(e) => onChange({ latitude: e.target.value })} inputMode="decimal" />
          </Field>
          <Field label={t("di.field.longitude")} htmlFor="di-longitude">
            <input id="di-longitude" className={inputCls} value={draft.longitude} onChange={(e) => onChange({ longitude: e.target.value })} inputMode="decimal" />
          </Field>
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
            />
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}
