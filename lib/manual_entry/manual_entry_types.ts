/**
 * Manual Personnel Entry domain types (Phase XX — Admin Only).
 *
 * The shape of a single "Create" action from the new admin-only Create
 * Personnel form. Deliberately a SUBSET of the fields the Officer Profile
 * Workspace can edit (OfficerProfilePatch) — a manually-created officer
 * starts with just the fields the spec requires and can be filled in further
 * via the existing edit workspace afterward, exactly like an AI-imported
 * record can.
 *
 * Pure domain typing — no I/O, no Prisma import.
 */

/** One Create Personnel submission. rank/firstName/lastName are the only required identity fields; everything else is optional, matching the spec's field list. */
export interface ManualEntryCreateInput {
  rank: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  policeServiceNumber?: string | null;
  citizenId?: string | null;
  academyClass?: number | null;
  currentPosition?: string | null;
  currentUnit?: string | null;
  region?: string | null;
  dateOfBirth?: Date | null;
  /** วันบรรจุ — appointment/enlistment date. Stored as the first Timeline row (sequence 0), matching how career history is represented everywhere else (there is no separate "appointment date" column on Officer). */
  appointmentDate?: Date | null;
  phone?: string | null;
  email?: string | null;
  employmentStatus?: string | null;
  /** The acting admin (AuthUser.id / displayName) — stamped as createdBy/createdByName. */
  actorId: string;
  actorName: string;
}

/** Result of a create — the new officer's id plus whether a duplicate check found candidates (never populated when `created` is true; the caller blocks creation on a duplicate instead of creating and reporting). */
export interface ManualEntryCreateResult {
  officerId: string;
}

/** Thrown when duplicate candidates are found and creation is blocked. */
export class ManualEntryDuplicateError extends Error {
  constructor(public readonly candidates: import("@/lib/manual_entry/duplicate_check").DuplicateCandidate[]) {
    super("Duplicate officer candidate(s) found");
    this.name = "ManualEntryDuplicateError";
  }
}
