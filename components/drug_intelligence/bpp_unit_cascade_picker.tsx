/**
 * Create Case BPP cascade: บก.ตชด.ภาค → กก.ตชด. → ร้อย ตชด.
 *
 * Options come from docs/reference/bpp-unit-master.txt (via bpp_unit_master).
 * Canonical org ids are filled only when OrganizationEngine already has a
 * matching row — typed/selected labels never create organization records.
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import {
  BPP_REGION_LABELS,
  bppBattalionLabelsForRegion,
  bppCompanyLabelsForBattalion,
} from "@/lib/drug_intelligence/bpp_unit_master";
import { resolveBppOrgSelection, type BppOrgSelection } from "@/lib/drug_intelligence/resolve_bpp_org_selection";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";

export function BppUnitCascadePicker({
  value,
  onChange,
  organizationEngine,
}: {
  value: BppOrgSelection;
  onChange: (value: BppOrgSelection) => void;
  organizationEngine: OrganizationEngine | undefined;
}) {
  const { t } = useT();
  const regionKnown = BPP_REGION_LABELS.includes(value.regionText);
  const battalionOptions = bppBattalionLabelsForRegion(value.regionText);
  const battalionKnown = battalionOptions.includes(value.battalionText);
  const companyOptions = bppCompanyLabelsForBattalion(value.regionText, value.battalionText);

  function apply(labels: { regionText: string; battalionText: string; companyText: string }) {
    onChange(resolveBppOrgSelection(organizationEngine, labels));
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label={t("di.bpp.region")}>
        <Combobox
          value={value.regionText}
          onChange={(regionText) => apply({ regionText, battalionText: "", companyText: "" })}
          suggestions={BPP_REGION_LABELS}
          maxSuggestions={BPP_REGION_LABELS.length}
          placeholder={t("di.bpp.regionPlaceholder")}
          aria-label={t("di.bpp.region")}
        />
      </Field>
      <Field label={t("di.bpp.battalion")}>
        <Combobox
          value={value.battalionText}
          onChange={(battalionText) => apply({ regionText: value.regionText, battalionText, companyText: "" })}
          suggestions={battalionOptions}
          maxSuggestions={Math.max(battalionOptions.length, 1)}
          placeholder={regionKnown ? t("di.bpp.battalionPlaceholder") : t("di.bpp.selectRegionFirst")}
          disabled={!regionKnown}
          aria-label={t("di.bpp.battalion")}
        />
      </Field>
      <Field label={t("di.bpp.company")}>
        <Combobox
          value={value.companyText}
          onChange={(companyText) => apply({ regionText: value.regionText, battalionText: value.battalionText, companyText })}
          suggestions={companyOptions}
          maxSuggestions={Math.max(companyOptions.length, 1)}
          placeholder={battalionKnown ? t("di.bpp.companyPlaceholder") : t("di.bpp.selectBattalionFirst")}
          disabled={!battalionKnown}
          aria-label={t("di.bpp.company")}
        />
      </Field>
    </div>
  );
}
