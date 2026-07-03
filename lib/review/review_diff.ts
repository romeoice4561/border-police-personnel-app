/**
 * ReviewDiffEngine
 *
 * Compares the AI's original extraction against a human-edited version and
 * reports field-level additions, removals, and changes. Timeline entries
 * are diffed by index (position in the array) since there is no stable id
 * to key by — a future revision could adopt content-based matching if
 * reordering without editing becomes common.
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type { DiffResult, FieldDiff } from "@/lib/review/review_types";

const SCALAR_FIELDS: Array<keyof PersonnelExtraction> = [
  "rank",
  "first_name",
  "last_name",
  "position",
  "unit",
  "phone",
  "notes",
];

/** Contract for diffing two extractions. Allows swapping in a different comparison strategy later. */
export interface DiffEngine {
  diff(original: PersonnelExtraction, edited: PersonnelExtraction): DiffResult;
}

/**
 * Default field-by-field diff engine.
 *
 * Future extension point: content-based (rather than index-based) timeline
 * entry matching, and configurable field-level ignore rules (e.g. ignore
 * whitespace-only changes).
 */
export class DefaultDiffEngine implements DiffEngine {
  diff(original: PersonnelExtraction, edited: PersonnelExtraction): DiffResult {
    const changed: FieldDiff[] = [];
    const added: FieldDiff[] = [];
    const removed: FieldDiff[] = [];

    for (const field of SCALAR_FIELDS) {
      if (original[field] !== edited[field]) {
        changed.push({ field, type: "changed", before: original[field], after: edited[field] });
      }
    }

    this.diffTimeline(original, edited, added, removed, changed);

    return {
      added,
      removed,
      changed,
      hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
    };
  }

  private diffTimeline(
    original: PersonnelExtraction,
    edited: PersonnelExtraction,
    added: FieldDiff[],
    removed: FieldDiff[],
    changed: FieldDiff[]
  ): void {
    const maxLength = Math.max(original.timeline.length, edited.timeline.length);

    for (let i = 0; i < maxLength; i += 1) {
      const before = original.timeline[i];
      const after = edited.timeline[i];
      const field = `timeline[${i}]`;

      if (before === undefined && after !== undefined) {
        added.push({ field, type: "added", after });
      } else if (before !== undefined && after === undefined) {
        removed.push({ field, type: "removed", before });
      } else if (before !== undefined && after !== undefined) {
        const isEqual =
          before.year === after.year && before.position === after.position && before.unit === after.unit;
        if (!isEqual) {
          changed.push({ field, type: "changed", before, after });
        }
      }
    }
  }
}
