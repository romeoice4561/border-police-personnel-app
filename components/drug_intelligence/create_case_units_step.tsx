/**
 * Create Case — Units & Arrest Team step (Phase DI-7.6, Sections 8/9).
 *
 * Participating units keep three distinct sources:
 *   BPP cascade (reporting/lead semantics stay elsewhere)
 *   joint/external organization suggestions from หน่วยที่ชอบจับยา.txt
 *   "หน่วยอื่น / ไม่พบหน่วย"
 *
 * Selecting a participating organization never copies it into reporting or
 * lead arrest unit.
 */
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { CreateCaseOrgSourcePicker } from "@/components/drug_intelligence/create_case_org_source_picker";
import { OfficerPicker } from "@/components/drug_intelligence/officer_picker";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_UNIT_ROLES, DRUG_CASE_UNIT_ROLE_LABELS, DRUG_CASE_OFFICER_ROLES, DRUG_CASE_OFFICER_ROLE_LABELS } from "@/lib/drug_intelligence/drug_case_officer_options";
import {
  createEmptyParticipatingUnitDraft,
  createEmptyCaseOfficerDraft,
  type CreateCaseDraft,
  type ParticipatingUnitDraft,
  type CaseOfficerDraft,
} from "@/lib/drug_intelligence/create_case_draft";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { OfficerSummary } from "@/lib/ui/api_client";

export function CreateCaseUnitsStep({
  draft,
  onChange,
  organizationEngine,
}: {
  draft: CreateCaseDraft;
  onChange: (patch: Partial<CreateCaseDraft>) => void;
  organizationEngine: OrganizationEngine | undefined;
}) {
  const { t } = useT();

  const unitRoleOptions = DRUG_CASE_UNIT_ROLES.map((r) => ({ value: r, label: DRUG_CASE_UNIT_ROLE_LABELS[r].labelTh }));
  const officerRoleOptions = DRUG_CASE_OFFICER_ROLES.map((r) => ({ value: r, label: DRUG_CASE_OFFICER_ROLE_LABELS[r].labelTh }));

  function updateUnit(key: string, patch: Partial<ParticipatingUnitDraft>) {
    onChange({ participatingUnits: draft.participatingUnits.map((u) => (u.key === key ? { ...u, ...patch } : u)) });
  }
  function removeUnit(key: string) {
    onChange({ participatingUnits: draft.participatingUnits.filter((u) => u.key !== key) });
  }
  function updateOfficer(key: string, patch: Partial<CaseOfficerDraft>) {
    onChange({ officers: draft.officers.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  }
  function removeOfficer(key: string) {
    onChange({ officers: draft.officers.filter((o) => o.key !== key) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t("di.participatingUnits.sectionLabel")}</p>
              <p className="text-xs text-muted">{t("di.participatingUnits.stepHelper")}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ participatingUnits: [...draft.participatingUnits, createEmptyParticipatingUnitDraft()] })}>
              {t("di.participatingUnits.addButton")}
            </Button>
          </div>
          {draft.participatingUnits.length === 0 ? (
            <p className="text-sm text-muted">{t("di.participatingUnits.empty")}</p>
          ) : (
            <div className="space-y-3">
              {draft.participatingUnits.map((unit) => (
                <ParticipatingUnitRow
                  key={unit.key}
                  unit={unit}
                  roleOptions={unitRoleOptions}
                  organizationEngine={organizationEngine}
                  onChange={(patch) => updateUnit(unit.key, patch)}
                  onRemove={() => removeUnit(unit.key)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.arrestTeam.sectionLabel")}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ officers: [...draft.officers, createEmptyCaseOfficerDraft()] })}>
              {t("di.arrestTeam.addButton")}
            </Button>
          </div>
          {draft.officers.length === 0 ? (
            <p className="text-sm text-muted">{t("di.arrestTeam.empty")}</p>
          ) : (
            <div className="space-y-3">
              {draft.officers.map((officer) => (
                <CaseOfficerRow
                  key={officer.key}
                  officer={officer}
                  roleOptions={officerRoleOptions}
                  onChange={(patch) => updateOfficer(officer.key, patch)}
                  onRemove={() => removeOfficer(officer.key)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ParticipatingUnitRow({
  unit,
  roleOptions,
  organizationEngine,
  onChange,
  onRemove,
}: {
  unit: ParticipatingUnitDraft;
  roleOptions: { value: string; label: string }[];
  organizationEngine: OrganizationEngine | undefined;
  onChange: (patch: Partial<ParticipatingUnitDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <CreateCaseOrgSourcePicker
            organizationEngine={organizationEngine}
            value={{
              useManual: unit.useManualUnit,
              manualText: unit.manualUnitText,
              bpp: {
                headquartersId: unit.headquartersId,
                headquartersText: unit.headquartersText,
                regionId: unit.regionId,
                regionText: unit.regionText,
                battalionId: unit.battalionId,
                battalionText: unit.battalionText,
                companyId: unit.companyId,
                companyText: unit.companyText,
              },
            }}
            onChange={(next) =>
              onChange({
                useManualUnit: next.useManual,
                manualUnitText: next.manualText,
                headquartersId: next.bpp.headquartersId,
                headquartersText: next.bpp.headquartersText,
                regionId: next.bpp.regionId,
                regionText: next.bpp.regionText,
                battalionId: next.bpp.battalionId,
                battalionText: next.bpp.battalionText,
                companyId: next.bpp.companyId,
                companyText: next.bpp.companyText,
              })
            }
          />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={t("di.participatingUnits.roleLabel")}>
          <Select options={roleOptions} value={unit.role} onChange={(e) => onChange({ role: e.target.value })} />
        </Field>
        <Field label={t("di.participatingUnits.noteLabel")}>
          <input className={inputCls} value={unit.note} onChange={(e) => onChange({ note: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function CaseOfficerRow({
  officer,
  roleOptions,
  onChange,
  onRemove,
}: {
  officer: CaseOfficerDraft;
  roleOptions: { value: string; label: string }[];
  onChange: (patch: Partial<CaseOfficerDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<"internal" | "manual">(officer.officerId ? "internal" : officer.manualFullName ? "manual" : "internal");

  function handleSelectOfficer(picked: OfficerSummary) {
    onChange({
      officerId: picked.officerId,
      officerLabel: `${picked.rank} ${picked.firstName} ${picked.lastName}`,
      manualRank: "",
      manualFullName: "",
      manualPosition: "",
      manualUnitText: "",
    });
  }

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("internal")}
              className={`rounded-md px-2 py-1 ${mode === "internal" ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface"}`}
            >
              {t("di.arrestTeam.pickFromPersonnel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("manual");
                onChange({ officerId: null, officerLabel: null });
              }}
              className={`rounded-md px-2 py-1 ${mode === "manual" ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface"}`}
            >
              {t("di.arrestTeam.externalPerson")}
            </button>
          </div>

          {mode === "internal" ? (
            officer.officerId ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="text-xs text-muted">{t("di.arrestTeam.selectedOfficer")}: </span>
                  {officer.officerLabel}
                </span>
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => onChange({ officerId: null, officerLabel: null })}>
                  {t("di.arrestTeam.changeSelection")}
                </button>
              </div>
            ) : (
              <OfficerPicker onSelect={handleSelectOfficer} />
            )
          ) : (
            <div className="space-y-2">
              <HelperText>{t("di.arrestTeam.manualHelperText")}</HelperText>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label={t("di.arrestTeam.manualRank")}>
                  <input className={inputCls} value={officer.manualRank} onChange={(e) => onChange({ manualRank: e.target.value })} />
                </Field>
                <Field label={t("di.arrestTeam.manualFullName")} required>
                  <input className={inputCls} value={officer.manualFullName} onChange={(e) => onChange({ manualFullName: e.target.value })} />
                </Field>
                <Field label={t("di.arrestTeam.manualPosition")}>
                  <input className={inputCls} value={officer.manualPosition} onChange={(e) => onChange({ manualPosition: e.target.value })} />
                </Field>
                <Field label={t("di.arrestTeam.manualUnit")}>
                  <input className={inputCls} value={officer.manualUnitText} onChange={(e) => onChange({ manualUnitText: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={t("di.arrestTeam.roleLabel")}>
          <Select options={roleOptions} value={officer.role} onChange={(e) => onChange({ role: e.target.value })} />
        </Field>
        <Field label={t("di.arrestTeam.noteLabel")}>
          <input className={inputCls} value={officer.note} onChange={(e) => onChange({ note: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
