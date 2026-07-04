/**
 * UnitResolver (Phase 17).
 *
 * Resolves the organizational units referenced by an officer's record to
 * persisted Unit rows, upserting by unique `name` so IDs are reused and units
 * are never duplicated. Reuses the existing UnitRepository (no duplicated data
 * access); it only decides WHICH names to resolve (current unit + every
 * timeline unit, distinct, non-empty).
 *
 * Runs inside the caller's transaction: the UnitRepository is constructed over
 * the transaction-scoped client passed to `resolve()`.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { UnitRepository } from "@/lib/database/repositories/unit_repository";
import { DatabaseError } from "@/lib/import/types";

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Distinct, non-empty unit names from the current unit plus every timeline unit. */
export function collectUnitNames(currentUnit: string | null, timelineUnits: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const add = (value: string | null | undefined) => {
    const trimmed = nonEmpty(value ?? null);
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      names.push(trimmed);
    }
  };
  add(currentUnit);
  for (const unit of timelineUnits) add(unit);
  return names;
}

export interface UnitResolution {
  /** How many unit rows were newly created (vs. reused). */
  created: number;
  /** All resolved unit names (created + reused). */
  names: string[];
}

/**
 * Upserts every referenced unit by name within the transaction. Idempotent:
 * a name already present is reused (its row/id untouched), so re-import never
 * duplicates units. Wraps repository failures in DatabaseError.
 */
export async function resolveUnits(
  tx: DatabaseClient,
  currentUnit: string | null,
  timelineUnits: Array<string | null | undefined>
): Promise<UnitResolution> {
  const repo = new UnitRepository(tx);
  const names = collectUnitNames(currentUnit, timelineUnits);

  let created = 0;
  try {
    for (const name of names) {
      const { created: wasCreated } = await repo.upsert(name, 0);
      if (wasCreated) created += 1;
    }
  } catch (error) {
    throw new DatabaseError(`Failed to resolve units [${names.join(", ")}]`, error);
  }

  return { created, names };
}
