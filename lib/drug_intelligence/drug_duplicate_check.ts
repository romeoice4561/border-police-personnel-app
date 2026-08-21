/**
 * Duplicate-safety checks for Drug Intelligence Person records (Phase DI-1
 * — Section 14).
 *
 * "ใน DI-1 ยังไม่ต้องสร้าง Matching Engine เต็มรูปแบบ แต่ database/service layer
 * ต้องเตรียมรองรับ" — this is the minimal version: before a NEW DrugPerson is
 * created, check identifier and name+DOB candidates and report them. It is
 * the CALLER's job (the service layer, then eventually the UI) to decide
 * what to do with a candidate list — this module never merges, never
 * silently proceeds past a match, and never silently blocks either; it only
 * answers "are there candidates?".
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";

export interface DrugPersonDuplicateCandidate {
  personId: string;
  primaryFullName: string;
  reasons: string[];
}

export interface DrugPersonDuplicateCheckInput {
  identifiers: Array<{ type: string; value: string }>;
  primaryFullName: string;
  dateOfBirth: Date | null;
}

/**
 * Returns every DrugPerson that plausibly matches the given identity
 * signals. An identifier match is a STRONG signal (Section 14: "เลขบัตร/
 * Passport match อาจเป็น strong signal") but is still only ever reported as a
 * candidate, never auto-resolved.
 */
export async function findDrugPersonDuplicateCandidates(
  db: DatabaseClient,
  input: DrugPersonDuplicateCheckInput
): Promise<DrugPersonDuplicateCandidate[]> {
  const personRepo = new DrugPersonRepository(db);
  const matches = new Map<string, DrugPersonDuplicateCandidate>();

  function record(personId: string, primaryFullName: string, reason: string) {
    const existing = matches.get(personId);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    matches.set(personId, { personId, primaryFullName, reasons: [reason] });
  }

  for (const identifier of input.identifiers) {
    if (!identifier.value.trim()) continue;
    const rows = await personRepo.findCandidatesByIdentifier(identifier.type, identifier.value.trim());
    for (const row of rows) {
      const person = await personRepo.findById(row.personId);
      if (person) record(person.id, person.primaryFullName, `identifier:${identifier.type}`);
    }
  }

  if (input.primaryFullName.trim() && input.dateOfBirth) {
    const rows = await personRepo.findCandidatesByNameAndDob(input.primaryFullName.trim(), input.dateOfBirth);
    for (const row of rows) record(row.id, row.primaryFullName, "nameAndDateOfBirth");
  }

  return Array.from(matches.values());
}
