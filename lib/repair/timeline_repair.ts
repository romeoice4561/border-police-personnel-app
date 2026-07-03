/**
 * Timeline repairs (Phase 10C).
 *
 * Pure repairs over the timeline array, targeting the most common validation
 * failure observed in production: a model that returns a placeholder entry
 * like { year: "", position: "", unit: "" } when the source card has no
 * career table. Such an entry is not a fact — it is an empty placeholder — so
 * removing it is a legitimate "remove invalid value" repair (it turns
 * timeline: [ {empty} ] into timeline: [], which validates), NOT invention.
 *
 * Repairs applied, in order:
 *   1. Per-entry field repair (Thai numerals, year reformat, whitespace).
 *   2. Remove entries that are entirely empty after cleaning (no year AND no
 *      position AND no unit) — a placeholder, not a real timeline row.
 *   3. Remove exact-duplicate rows.
 *   4. Reorder newest → oldest.
 *
 * It NEVER fills in a missing year/position/unit and never adds rows. A row
 * that has a real position but a blank year (or vice-versa) is KEPT as-is so
 * validation can still legitimately flag it — repair does not paper over a
 * partially-missing real entry by deleting it.
 *
 * Pure: returns a new array; never mutates input entries or the input array.
 */

import type { TimelineEntry } from "@/lib/types/vision";
import type { RepairAction } from "@/lib/repair/repair_types";
import { repairYear, repairRequiredString } from "@/lib/repair/field_repair";

export interface RepairedTimeline {
  value: TimelineEntry[];
  actions: RepairAction[];
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/** An entry with no year, no position, and no unit is an empty placeholder — not a real row. */
function isEmptyEntry(entry: TimelineEntry): boolean {
  return isBlank(entry.year) && isBlank(entry.position) && isBlank(entry.unit ?? "");
}

function sortableYearValue(year: string): number {
  const numeric = Number.parseInt(year, 10);
  if (Number.isFinite(numeric) && /^\d+$/.test(year)) return numeric;

  const presentMarkers = ["ปัจจุบัน", "present", "current"];
  if (presentMarkers.some((marker) => year.toLowerCase().includes(marker.toLowerCase()))) {
    return Number.POSITIVE_INFINITY;
  }
  return Number.NEGATIVE_INFINITY;
}

function dedupKey(entry: TimelineEntry): string {
  return JSON.stringify([entry.year, entry.position, entry.unit ?? null]);
}

/**
 * Repairs a timeline array. `timeline` is assumed to already be an array
 * (structural validation guarantees this before repair runs on well-formed
 * data; a caller passing a non-array should not reach here). Non-object
 * entries are dropped as invalid.
 */
export function repairTimeline(timeline: TimelineEntry[]): RepairedTimeline {
  const actions: RepairAction[] = [];

  // 1. Clean each entry's fields.
  const cleaned: TimelineEntry[] = timeline.map((entry, index) => {
    if (entry === null || typeof entry !== "object") {
      return { year: "", position: "", unit: null };
    }

    const yearResult = repairYear(entry.year ?? "", `timeline[${index}].year`);
    const positionResult = repairRequiredString(entry.position ?? "", `timeline[${index}].position`);
    actions.push(...yearResult.actions, ...positionResult.actions);

    let unit: string | null | undefined = entry.unit;
    if (typeof entry.unit === "string") {
      const unitResult = repairRequiredString(entry.unit, `timeline[${index}].unit`);
      actions.push(...unitResult.actions);
      // repairRequiredString never returns null; unit stays a string here.
      unit = unitResult.value ?? entry.unit;
    }

    return {
      year: yearResult.value ?? "",
      position: positionResult.value ?? "",
      unit,
    };
  });

  // 2. Remove entirely-empty placeholder entries.
  const nonEmpty: TimelineEntry[] = [];
  cleaned.forEach((entry, index) => {
    if (isEmptyEntry(entry)) {
      actions.push({
        type: "timeline_remove_empty",
        field: `timeline[${index}]`,
        detail: "removed empty placeholder timeline entry (no year/position/unit)",
      });
      return;
    }
    nonEmpty.push(entry);
  });

  // 3. Remove exact duplicates.
  const seen = new Set<string>();
  const deduped: TimelineEntry[] = [];
  for (const entry of nonEmpty) {
    const key = dedupKey(entry);
    if (seen.has(key)) {
      actions.push({ type: "timeline_dedup", field: "timeline", detail: `removed duplicate entry ${key}` });
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }

  // 4. Reorder newest → oldest (report only if the order actually changed).
  const ordered = [...deduped].sort((a, b) => sortableYearValue(b.year) - sortableYearValue(a.year));
  const reordered = ordered.some((entry, i) => entry !== deduped[i]);
  if (reordered) {
    actions.push({ type: "timeline_reorder", field: "timeline", detail: "reordered timeline newest → oldest" });
  }

  return { value: ordered, actions };
}
