/**
 * Repair rules (Phase 10C).
 *
 * Declares WHICH repair each field of a PersonnelExtraction receives, as a
 * small set of pure rule functions the RepairEngine applies in order. Keeping
 * the field→repair mapping here (rather than inline in the engine) mirrors the
 * classifier's rules/engine split: rules are independently testable and
 * reorderable, the engine only orchestrates and re-validates.
 *
 * The rules only ever call the allowed field/timeline repairs (normalize,
 * reformat, convert, trim, dedup, remove-invalid, blank→null). No rule
 * invents a value.
 *
 * Pure: each rule returns the changed slice of the extraction plus its
 * actions; no mutation, no globals, no I/O.
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type { RepairAction } from "@/lib/repair/repair_types";
import { repairPhone, repairRequiredString } from "@/lib/repair/field_repair";
import { repairTimeline } from "@/lib/repair/timeline_repair";

/** Required top-level string fields that get required-string repair (cleaned but never nulled/invented). */
const REQUIRED_STRING_FIELDS: Array<keyof Pick<PersonnelExtraction, "rank" | "first_name" | "last_name" | "position" | "unit">> = [
  "rank",
  "first_name",
  "last_name",
  "position",
  "unit",
];

/** A repair rule takes the current extraction and returns a partial patch + the actions taken. */
export interface RepairRule {
  apply(extraction: PersonnelExtraction): { patch: Partial<PersonnelExtraction>; actions: RepairAction[] };
}

/** Cleans required string fields (Thai numerals, whitespace, dashes). Never nulls or invents them. */
export class RequiredStringRepairRule implements RepairRule {
  apply(extraction: PersonnelExtraction) {
    const patch: Partial<PersonnelExtraction> = {};
    const actions: RepairAction[] = [];

    for (const field of REQUIRED_STRING_FIELDS) {
      const result = repairRequiredString(extraction[field] ?? "", field);
      if (result.value !== null && result.value !== extraction[field]) {
        patch[field] = result.value;
      }
      actions.push(...result.actions);
    }

    return { patch, actions };
  }
}

/** Cleans the notes field, blank → null-equivalent empty (notes is optional; kept as "" for shape stability). */
export class NotesRepairRule implements RepairRule {
  apply(extraction: PersonnelExtraction) {
    const actions: RepairAction[] = [];
    const result = repairRequiredString(extraction.notes ?? "", "notes");
    const patch: Partial<PersonnelExtraction> = {};
    if (result.value !== null && result.value !== extraction.notes) {
      patch.notes = result.value;
    }
    actions.push(...result.actions);
    return { patch, actions };
  }
}

/** Reformats/dedups the phone number; blank → null becomes "" for the string-typed field. */
export class PhoneRepairRule implements RepairRule {
  apply(extraction: PersonnelExtraction) {
    const actions: RepairAction[] = [];
    const result = repairPhone(extraction.phone ?? "", "phone");
    const patch: Partial<PersonnelExtraction> = {};
    // phone is a required-shape string field on PersonnelExtraction; a
    // null (blank) repair maps to "" so the type stays a string while the
    // blank_to_null action is still reported.
    const repaired = result.value ?? "";
    if (repaired !== extraction.phone) {
      patch.phone = repaired;
    }
    actions.push(...result.actions);
    return { patch, actions };
  }
}

/** Repairs the timeline: per-entry cleanup, remove empty placeholders, dedup, reorder. */
export class TimelineRepairRule implements RepairRule {
  apply(extraction: PersonnelExtraction) {
    const actions: RepairAction[] = [];
    if (!Array.isArray(extraction.timeline)) {
      return { patch: {}, actions };
    }
    const result = repairTimeline(extraction.timeline);
    actions.push(...result.actions);
    return { patch: { timeline: result.value }, actions };
  }
}

/** The default ordered rule set the RepairEngine applies. */
export function createDefaultRepairRules(): RepairRule[] {
  return [
    new RequiredStringRepairRule(),
    new NotesRepairRule(),
    new PhoneRepairRule(),
    new TimelineRepairRule(),
  ];
}
