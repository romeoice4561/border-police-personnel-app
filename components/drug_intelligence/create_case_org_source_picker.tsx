/**
 * Shared BPP / joint-org / other-unit source switch for Create Case.
 * Used by the lead-arrest picker (when our unit is supporting) and by
 * participating-unit rows. Never creates organization master rows.
 */
"use client";

import { useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { BppUnitCascadePicker } from "@/components/drug_intelligence/bpp_unit_cascade_picker";
import { HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { JOINT_DRUG_ENFORCEMENT_ORG_LABELS, isJointDrugEnforcementOrgLabel } from "@/lib/drug_intelligence/joint_drug_enforcement_orgs";
import type { BppOrgSelection } from "@/lib/drug_intelligence/resolve_bpp_org_selection";
import { emptyOrgHierarchyValue } from "@/lib/drug_intelligence/resolve_bpp_org_selection";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { cn } from "@/lib/ui/cn";

export type OrgSourceMode = "bpp" | "joint" | "other";

export function orgSourceModeFromManual(useManual: boolean, manualText: string): OrgSourceMode {
  if (!useManual) return "bpp";
  return isJointDrugEnforcementOrgLabel(manualText) ? "joint" : "other";
}

export interface OrgSourceValue {
  useManual: boolean;
  manualText: string;
  bpp: BppOrgSelection;
}

export function CreateCaseOrgSourcePicker({
  organizationEngine,
  value,
  onChange,
}: {
  organizationEngine: OrganizationEngine | undefined;
  value: OrgSourceValue;
  onChange: (next: OrgSourceValue) => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<OrgSourceMode>(() => orgSourceModeFromManual(value.useManual, value.manualText));

  function switchMode(next: OrgSourceMode) {
    setMode(next);
    if (next === "bpp") {
      onChange({ useManual: false, manualText: "", bpp: emptyOrgHierarchyValue() });
      return;
    }
    onChange({ useManual: true, manualText: "", bpp: emptyOrgHierarchyValue() });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["bpp", t("di.joint.sourceBpp")],
            ["joint", t("di.joint.sourceJoint")],
            ["other", t("di.org.fallbackOption")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => switchMode(id)}
            className={cn("rounded-md px-2 py-1 text-xs", mode === id ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface")}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "bpp" ? (
        <BppUnitCascadePicker
          organizationEngine={organizationEngine}
          value={value.bpp}
          onChange={(bpp) => onChange({ useManual: false, manualText: "", bpp })}
        />
      ) : null}

      {mode === "joint" ? (
        <div className="space-y-1">
          <Combobox
            value={value.manualText}
            onChange={(manualText) => onChange({ useManual: true, manualText, bpp: emptyOrgHierarchyValue() })}
            suggestions={JOINT_DRUG_ENFORCEMENT_ORG_LABELS}
            maxSuggestions={JOINT_DRUG_ENFORCEMENT_ORG_LABELS.length}
            placeholder={t("di.joint.placeholder")}
            aria-label={t("di.joint.sourceJoint")}
          />
          <HelperText>{t("di.joint.helper")}</HelperText>
        </div>
      ) : null}

      {mode === "other" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
            <span>{t("di.org.manualLabel")}</span>
          </div>
          <input
            className={inputCls}
            value={value.manualText}
            onChange={(e) => onChange({ useManual: true, manualText: e.target.value, bpp: emptyOrgHierarchyValue() })}
            placeholder={t("di.hint.orgOther")}
          />
          <HelperText>{t("di.org.manualHelperText")}</HelperText>
        </div>
      ) : null}
    </div>
  );
}
