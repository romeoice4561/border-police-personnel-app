/**
 * Officer Profile Workspace domain types (Phase 23A).
 *
 * The shape of a single "Save" action from the editable Officer Profile
 * Workspace: every section (basic info/contact, career timeline, education,
 * training) is optional in the payload — a section the user didn't touch is
 * simply omitted and left completely unchanged, so a save from one card never
 * clobbers another. Timeline/Education/Training use REPLACE-ALL semantics
 * (mirrors the existing import pipeline's TimelineRepository.replaceForOfficer):
 * when a section IS present, its full row list replaces what's persisted.
 *
 * Pure domain typing — no I/O, no Prisma import.
 */

import type { OfficerProfilePatch } from "@/lib/database/repositories/officer_repository";
import type { TimelineRowInput } from "@/lib/database/repositories/timeline_repository";
import type { EducationRowInput } from "@/lib/database/repositories/education_repository";
import type { TrainingRowInput } from "@/lib/database/repositories/training_repository";
import type { SalaryHistoryRowInput } from "@/lib/database/repositories/salary_history_repository";

export type { OfficerProfilePatch, TimelineRowInput, EducationRowInput, TrainingRowInput, SalaryHistoryRowInput };

/** One batched save request for an officer's editable workspace data. */
export interface OfficerProfileSaveInput {
  profile?: OfficerProfilePatch;
  /** When present, REPLACES the officer's entire timeline (delete-all then recreate). */
  timeline?: TimelineRowInput[];
  /** When present, REPLACES the officer's entire education list. */
  education?: EducationRowInput[];
  /** When present, REPLACES the officer's entire training list. */
  training?: TrainingRowInput[];
  /** When present, REPLACES the officer's entire salary-history list (Phase 28A). */
  salaryHistory?: SalaryHistoryRowInput[];
}

/** Result of a save — which sections were actually written, for the UI to confirm. */
export interface OfficerProfileSaveResult {
  officerId: string;
  profileUpdated: boolean;
  timelineRowCount: number | null;
  educationRowCount: number | null;
  trainingRowCount: number | null;
  salaryHistoryRowCount: number | null;
}

/** Thrown when a save targets an officer that does not exist. */
export class OfficerNotFoundError extends Error {
  constructor(officerId: string) {
    super(`Officer '${officerId}' not found`);
    this.name = "OfficerNotFoundError";
  }
}
