/**
 * Border Patrol Division default values (Phase 26B Part C).
 *
 * Maps to the EXISTING Region table (Phase 20A) — per the explicit
 * instruction, Region IS the "Border Patrol Division" level; this is a
 * display-label default list only, not a new table. `regionCode` is the
 * existing Region.code ("1".."4") this division corresponds to, so the UI
 * can offer "ตชด.ภาค 4" as a friendly label while still resolving to the real
 * seeded Region row.
 *
 * Pure data — no I/O, no React.
 */

export interface BorderPatrolDivisionOption {
  regionCode: string;
  label: string;
}

export const BORDER_PATROL_DIVISION_DEFAULTS: readonly BorderPatrolDivisionOption[] = [
  { regionCode: "1", label: "ตชด.ภาค 1" },
  { regionCode: "2", label: "ตชด.ภาค 2" },
  { regionCode: "3", label: "ตชด.ภาค 3" },
  { regionCode: "4", label: "ตชด.ภาค 4" },
];

export const BORDER_PATROL_DIVISION_OPTIONS: readonly string[] = BORDER_PATROL_DIVISION_DEFAULTS.map((d) => d.label);

/**
 * The Border Patrol Division combobox's display label for a Region, given
 * only its `code` (e.g. "4") and `nameTh` (e.g. "ภาค 4") — "ตชด.ภาค 4" when a
 * default division label is registered for that region code, else the raw
 * `nameTh` (a region outside the Border Patrol Police branch, or a future
 * custom region with no default label). Shared by the OrgHierarchyPicker's
 * own onChange handlers and by useOfficerWorkspace's initial-load mapping,
 * so a persisted row displays the exact same label the picker would show
 * after selecting it interactively.
 */
export function divisionLabelForRegion(region: { code: string; nameTh: string }): string {
  const division = BORDER_PATROL_DIVISION_DEFAULTS.find((d) => d.regionCode === region.code);
  return division ? division.label : region.nameTh;
}
