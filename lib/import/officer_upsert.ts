/**
 * OfficerUpsert (Phase 17).
 *
 * Maps the OCR pipeline's `normalized_extraction` (+ career_intelligence,
 * confidence) onto the Officer model and upserts by the deterministic
 * `officerId`, reusing the existing OfficerRepository. Find-by-officerId → if
 * present update, else create — idempotent by construction.
 *
 * Runs inside the caller's transaction (repository built over the tx client).
 * The field mapping mirrors the Phase 12 database importer exactly, so JSON
 * and export-based imports write identical Officer rows.
 */

import type { DatabaseClient, Officer } from "@/lib/database/database_types";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { DatabaseError, type ResolvedImportInput } from "@/lib/import/types";
import { canonicalExtraction } from "@/lib/import/validation";

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

/** The most-recent timeline entry (present marker wins, else highest year, else first) — for current unit/position. */
function currentFromTimeline(
  timeline: Array<{ year?: string | null; position?: string | null; unit?: string | null }>,
  fallbackPosition: string | null,
  fallbackUnit: string | null
): { position: string | null; unit: string | null } {
  if (timeline.length === 0) return { position: fallbackPosition, unit: fallbackUnit };

  const presentMarkers = ["ปัจจุบัน", "present", "current"];
  const present = timeline.find((e) => presentMarkers.some((m) => (e.year ?? "").toLowerCase().includes(m)));
  const chosen = present ?? timeline[0];

  return {
    position: nonEmpty(chosen.position) ?? fallbackPosition,
    unit: nonEmpty(chosen.unit) ?? fallbackUnit,
  };
}

/**
 * Builds the OfficerInput from a resolved export file. `careerYears` and
 * scores are taken from the export's own `career_intelligence`/`confidence`
 * (the pipeline's computed values — never recomputed here).
 */
export function toOfficerInput(input: ResolvedImportInput): OfficerInput {
  const extraction = canonicalExtraction(input.file);
  const career = input.file.career_intelligence;
  const timeline = Array.isArray(extraction.timeline) ? extraction.timeline : [];

  const current = currentFromTimeline(
    timeline,
    nonEmpty(extraction.position),
    nonEmpty(extraction.unit)
  );

  const confidence = intOrNull(input.file.confidence ?? extraction.confidence);

  return {
    officerId: input.officerId,
    rank: (extraction.rank ?? "").trim(),
    firstName: (extraction.first_name ?? "").trim(),
    lastName: (extraction.last_name ?? "").trim(),
    currentPosition: current.position,
    currentUnit: current.unit,
    phone: nonEmpty(extraction.phone),
    careerYears: intOrNull(career?.careerYears) ?? 0,
    qualityScore: confidence,
    // Knowledge score mirrors the pipeline's extraction confidence, matching
    // the Phase 12 importer's mapping so both paths write the same value.
    knowledgeScore: confidence,
    region: nonEmpty(input.region),
    confidence,
  };
}

/**
 * Upserts the officer within the transaction. Returns the persisted row and
 * whether it was created (vs. updated). Wraps repository failures in
 * DatabaseError.
 */
export async function upsertOfficer(
  tx: DatabaseClient,
  input: ResolvedImportInput
): Promise<{ officer: Officer; created: boolean }> {
  const repo = new OfficerRepository(tx);
  try {
    return await repo.upsert(toOfficerInput(input));
  } catch (error) {
    throw new DatabaseError(`Failed to upsert officer ${input.officerId}`, error);
  }
}
