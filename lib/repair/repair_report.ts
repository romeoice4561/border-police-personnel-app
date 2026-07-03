/**
 * RepairReport helpers (Phase 10C).
 *
 * Small pure inspectors over a single RepairReport, so both the runner and
 * repair_statistics.ts share one definition of "was this image repaired",
 * "did repair recover validation", and how to tally repair types — rather
 * than each re-deriving it.
 *
 * Pure: no I/O, no globals.
 */

import type { RepairReport, RepairType } from "@/lib/repair/repair_types";

/** True if any repair action was applied to this image. */
export function wasRepaired(report: RepairReport): boolean {
  return report.repairsApplied.length > 0;
}

/**
 * True if repair turned a failing validation into a passing one — i.e. the
 * record was invalid before repair and valid after. This is the recovery the
 * phase is measuring.
 */
export function recoveredValidation(report: RepairReport): boolean {
  return !report.beforeValidation.valid && report.afterValidation.valid;
}

/** Counts of each repair type applied within a single report. */
export function repairTypeCounts(report: RepairReport): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const action of report.repairsApplied) {
    counts[action.type] = (counts[action.type] ?? 0) + 1;
  }
  return counts;
}

/** The set of distinct repair types present in a report. */
export function distinctRepairTypes(report: RepairReport): RepairType[] {
  return Array.from(new Set(report.repairsApplied.map((a) => a.type)));
}
