/**
 * Duplicate detection for Manual Personnel Entry (Phase XX — Admin Only).
 *
 * Before a hand-typed officer profile is created, the candidate is checked
 * against existing Officer rows on three signals — police service number
 * (`policeServiceNumber`; distinct from Officer.officerId, the import-
 * derived business key, and from the pre-existing `employeeNumber` field),
 * citizen ID (`citizenId`), and first name + last name + date of birth. Any
 * one match is reported as a candidate duplicate — the caller decides
 * whether to block creation (the API route does; see manual_entry_service.ts).
 *
 * Pure data access over the injected DatabaseClient — no I/O beyond the
 * provided client, no framework dependency.
 */

import type { DatabaseClient, Officer } from "@/lib/database/database_types";

export type DuplicateMatchReason = "policeServiceNumber" | "citizenId" | "nameAndDateOfBirth";

export interface DuplicateCandidate {
  officerId: string;
  firstName: string;
  lastName: string;
  rank: string;
  reasons: DuplicateMatchReason[];
}

export interface DuplicateCheckInput {
  policeServiceNumber?: string | null;
  citizenId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
}

/**
 * Finds existing officers that plausibly match `input` on any of the three
 * signals. Returns one entry per matching officer with every reason it
 * matched (an officer can match on more than one signal at once).
 */
export async function findDuplicateCandidates(db: DatabaseClient, input: DuplicateCandidateQuery): Promise<DuplicateCandidate[]> {
  const matches = new Map<string, DuplicateCandidate>();

  function record(officer: Officer, reason: DuplicateMatchReason) {
    const existing = matches.get(officer.officerId);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    matches.set(officer.officerId, {
      officerId: officer.officerId,
      firstName: officer.firstName,
      lastName: officer.lastName,
      rank: officer.rank,
      reasons: [reason],
    });
  }

  const policeServiceNumber = input.policeServiceNumber?.trim();
  if (policeServiceNumber) {
    const rows = await db.officer.findMany({ where: { policeServiceNumber } });
    for (const row of rows) record(row, "policeServiceNumber");
  }

  const citizenId = input.citizenId?.trim();
  if (citizenId) {
    const rows = await db.officer.findMany({ where: { citizenId } });
    for (const row of rows) record(row, "citizenId");
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (firstName && lastName && input.dateOfBirth) {
    const rows = await db.officer.findMany({
      where: { firstName, lastName, dateOfBirth: input.dateOfBirth },
    });
    for (const row of rows) record(row, "nameAndDateOfBirth");
  }

  return Array.from(matches.values());
}

type DuplicateCandidateQuery = DuplicateCheckInput;
