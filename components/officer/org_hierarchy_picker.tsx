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
 * Region/Headquarters, etc.) via lib/organization/org_tree.ts's pure
 * autoFillFrom* helpers. The user may always override any level afterward —
 * auto-fill only ever SETS the ancestor ids, it never locks them.
 *
 * A typed value that doesn't match any known row in the tree is preserved as
 * free text (matching the existing Rank/Position/Unit convention) but does
 * NOT resolve to an id — the row's headquartersId/regionId/battalionId/
 * companyId stay whatever they were, and only the legacy `unit` free-text
 * column reflects the typed text. This mirrors "Allow custom values": typing
 * a not-yet-seeded unit never blocks saving, it just isn't linked to the
 * structured hierarchy yet.
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import {
  battalionsForRegion,
  companiesForBattalion,
  autoFillFromCompany,
  autoFillFromBattalion,
  autoFillFromRegion,
  type OrgTree,
  type OrgSelection,
} from "@/lib/organization/org_tree";
import { HEADQUARTERS_OPTIONS } from "@/lib/organization/headquarters_options";
import { BORDER_PATROL_DIVISION_DEFAULTS, BORDER_PATROL_DIVISION_OPTIONS, divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";

export interface OrgHierarchyValue extends OrgSelection {
  /** Free-typed labels, kept in sync with the resolved ids when a selection matches a known row — never forced to match. */
  headquartersText: string;
  regionText: string;
  battalionText: string;
  companyText: string;
}

export interface OrgHierarchyPickerProps {
  tree: OrgTree;
  value: OrgHierarchyValue;
  onChange: (value: OrgHierarchyValue) => void;
}

function findByLabel<T extends { id: number }>(rows: T[], label: (row: T) => string, text: string): T | undefined {
  const needle = text.trim();
  if (!needle) return undefined;
  return rows.find((r) => label(r) === needle);
}

export function OrgHierarchyPicker({ tree, value, onChange }: OrgHierarchyPickerProps) {
  const battalionOptions = battalionsForRegion(tree, value.regionId);
  const companyOptions = companiesForBattalion(tree, value.battalionId);

  function onHeadquartersChange(text: string) {
    const match = findByLabel(tree.headquarters, (h) => h.nameTh, text);
    onChange({ ...value, headquartersText: text, headquartersId: match ? match.id : value.headquartersId });
  }

  /**
   * The "Border Patrol Division" combobox suggests friendly labels
   * ("ตชด.ภ.4") that are NOT the real Region.nameTh ("ภาค 4") — resolve via
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
      const filled = autoFillFromRegion(tree, match.id);
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
      const filled = autoFillFromBattalion(tree, match.id);
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
      const filled = autoFillFromCompany(tree, match.id);
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
      <LabeledField label="กองบัญชาการ (Headquarters)">
        <Combobox
          value={value.headquartersText}
          onChange={onHeadquartersChange}
          suggestions={HEADQUARTERS_OPTIONS}
          placeholder="เลือกหรือพิมพ์กองบัญชาการ"
          aria-label="กองบัญชาการ"
        />
      </LabeledField>

      <LabeledField label="กองบังคับการ ตชด.ภาค (Region)">
        <Combobox
          value={value.regionText}
          onChange={onRegionChange}
          suggestions={BORDER_PATROL_DIVISION_OPTIONS}
          placeholder="เลือกหรือพิมพ์ภาค"
          aria-label="กองบังคับการ ตชด.ภาค"
        />
      </LabeledField>

      <LabeledField label="กองกำกับ (Battalion)">
        <Combobox
          value={value.battalionText}
          onChange={onBattalionChange}
          suggestions={battalionOptions.map((b) => b.nameTh)}
          placeholder="เลือกหรือพิมพ์กองกำกับ"
          aria-label="กองกำกับ"
        />
      </LabeledField>

      <LabeledField label="กองร้อย (Company)">
        <Combobox
          value={value.companyText}
          onChange={onCompanyChange}
          suggestions={companyOptions.map((c) => c.nameTh)}
          placeholder="เลือกหรือพิมพ์กองร้อย"
          aria-label="กองร้อย"
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
