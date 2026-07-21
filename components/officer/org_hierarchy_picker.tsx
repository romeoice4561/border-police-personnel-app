/**
 * OrgHierarchyPicker (Phase 26B Part C/D/E).
 *
 * Replaces the single free-text "หน่วย" (Unit) field with 4 structured,
 * searchable selectors — Headquarters -> Border Patrol Division (Region) ->
 * Battalion -> Company — each reusing the shared Combobox primitive
 * (Part E: search/type/arrow-keys/enter/escape, never a forced closed list —
 * "Allow custom values"/"Allow manual values" per spec).
 *
 * Part D — Smart Auto Fill: selecting a Company derives its Battalion,
 * Region, and Headquarters automatically (and selecting a Battalion derives
 * Region/Headquarters, etc.) via the shared OrganizationEngine's `.cascade`
 * (Phase 27 — every screen's cascading logic goes through this ONE engine).
 * The user may always override any level afterward — auto-fill only ever
 * SETS the ancestor ids, it never locks them.
 *
 * A typed value that doesn't match any known row in the tree is preserved as
 * free text (matching the existing Rank/Position/Unit convention) and does
 * NOT resolve to an id — the corresponding *Id is cleared to null. Phase
 * 49A.2B persists the free-text labels on Timeline so they round-trip
 * independently of the id FKs and of the legacy `unit` column.
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import type { OrgSelection } from "@/lib/organization/org_tree";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { HEADQUARTERS_OPTIONS } from "@/lib/organization/headquarters_options";
import { BORDER_PATROL_DIVISION_DEFAULTS, BORDER_PATROL_DIVISION_OPTIONS, divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";
import { useT } from "@/components/i18n/language_provider";

export interface OrgHierarchyValue extends OrgSelection {
  /** Free-typed labels, kept in sync with the resolved ids when a selection matches a known row — never forced to match. */
  headquartersText: string;
  regionText: string;
  battalionText: string;
  companyText: string;
}

export interface OrgHierarchyPickerProps {
  /** Phase 27: the shared OrganizationEngine — the ONE source this picker's cascading options and auto-fill read from. */
  organizationEngine: OrganizationEngine;
  value: OrgHierarchyValue;
  onChange: (value: OrgHierarchyValue) => void;
}

function findByLabel<T extends { id: number }>(rows: readonly T[], label: (row: T) => string, text: string): T | undefined {
  const needle = text.trim();
  if (!needle) return undefined;
  return rows.find((r) => label(r) === needle);
}

export function OrgHierarchyPicker({ organizationEngine, value, onChange }: OrgHierarchyPickerProps) {
  const { t } = useT();
  const tree = organizationEngine.getOrganizationTree();
  const battalionOptions = organizationEngine.getBattalions(value.regionId);
  const companyOptions = organizationEngine.getCompanies(value.battalionId);

  function onHeadquartersChange(text: string) {
    const match = findByLabel(tree.headquarters, (h) => h.nameTh, text);
    onChange({ ...value, headquartersText: text, headquartersId: match ? match.id : null });
  }

  /**
   * The "Border Patrol Division" combobox suggests friendly labels
   * ("ตชด.ภาค 4") that are NOT the real Region.nameTh ("ภาค 4") — resolve via
   * BORDER_PATROL_DIVISION_DEFAULTS' regionCode first (the common case, a
   * suggestion pick), falling back to a direct nameTh match so typing/
   * pasting the real region name also resolves.
   */
  function findRegionByDivisionLabel(text: string) {
    const needle = text.trim();
    if (!needle) return undefined;
    const division = BORDER_PATROL_DIVISION_DEFAULTS.find((d) => d.label === needle);
    if (division) return tree.regions.find((r) => r.code === division.regionCode);
    return tree.regions.find((r) => r.nameTh === needle);
  }

  /** The Border Patrol Division combobox's display label for a resolved region id, or undefined when the region isn't found in the tree. */
  function divisionLabelFor(regionId: number | null): string | undefined {
    if (regionId === null) return undefined;
    const region = tree.regions.find((r) => r.id === regionId);
    return region ? divisionLabelForRegion(region) : undefined;
  }

  function onRegionChange(text: string) {
    const match = findRegionByDivisionLabel(text);
    if (match) {
      const filled = organizationEngine.cascade.fromRegion(match.id);
      onChange({
        ...value,
        regionText: text,
        battalionText: "",
        companyText: "",
        ...filled,
        // Smart Auto Fill: only overwrite headquarters text/selection when the region actually resolves one.
        headquartersText: filled.headquartersId ? (tree.headquarters.find((h) => h.id === filled.headquartersId)?.nameTh ?? value.headquartersText) : value.headquartersText,
      });
    } else {
      onChange({ ...value, regionText: text, regionId: null });
    }
  }

  function onBattalionChange(text: string) {
    const match = findByLabel(battalionOptions, (b) => b.nameTh, text);
    if (match) {
      const filled = organizationEngine.cascade.fromBattalion(match.id);
      onChange({
        ...value,
        battalionText: text,
        companyText: "",
        ...filled,
        regionText: filled.regionId ? (divisionLabelFor(filled.regionId) ?? value.regionText) : value.regionText,
        headquartersText: filled.headquartersId ? (tree.headquarters.find((h) => h.id === filled.headquartersId)?.nameTh ?? value.headquartersText) : value.headquartersText,
      });
    } else {
      onChange({ ...value, battalionText: text, battalionId: null });
    }
  }

  function onCompanyChange(text: string) {
    const match = findByLabel(companyOptions, (c) => c.nameTh, text);
    if (match) {
      const filled = organizationEngine.cascade.fromCompany(match.id);
      onChange({
        ...value,
        companyText: text,
        ...filled,
        battalionText: filled.battalionId ? (tree.battalions.find((b) => b.id === filled.battalionId)?.nameTh ?? value.battalionText) : value.battalionText,
        regionText: filled.regionId ? (divisionLabelFor(filled.regionId) ?? value.regionText) : value.regionText,
        headquartersText: filled.headquartersId ? (tree.headquarters.find((h) => h.id === filled.headquartersId)?.nameTh ?? value.headquartersText) : value.headquartersText,
      });
    } else {
      onChange({ ...value, companyText: text, companyId: null });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <LabeledField label={t("officer.orgHierarchy.headquarters")}>
        <Combobox
          value={value.headquartersText}
          onChange={onHeadquartersChange}
          suggestions={HEADQUARTERS_OPTIONS}
          placeholder="เลือกหรือพิมพ์กองบัญชาการ"
          aria-label={t("officer.orgHierarchy.headquarters")}
        />
      </LabeledField>

      <LabeledField label={t("officer.orgHierarchy.region")}>
        <Combobox
          value={value.regionText}
          onChange={onRegionChange}
          suggestions={BORDER_PATROL_DIVISION_OPTIONS}
          placeholder="เลือกหรือพิมพ์ภาค"
          aria-label={t("officer.orgHierarchy.region")}
        />
      </LabeledField>

      <LabeledField label={t("officer.orgHierarchy.battalion")}>
        <Combobox
          value={value.battalionText}
          onChange={onBattalionChange}
          suggestions={battalionOptions.map((b) => b.nameTh)}
          placeholder="เลือกหรือพิมพ์กองกำกับ"
          aria-label={t("officer.orgHierarchy.battalion")}
        />
      </LabeledField>

      <LabeledField label={t("officer.orgHierarchy.company")}>
        <Combobox
          value={value.companyText}
          onChange={onCompanyChange}
          suggestions={companyOptions.map((c) => c.nameTh)}
          placeholder="เลือกหรือพิมพ์กองร้อย"
          aria-label={t("officer.orgHierarchy.company")}
        />
      </LabeledField>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
