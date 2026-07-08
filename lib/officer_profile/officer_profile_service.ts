/**
 * OfficerProfileService (Phase 23A — Officer Profile Workspace).
 *
 * The application layer for saving user-driven edits to an officer's
 * workspace: profile fields (rank/name/position/unit/phone/contact), career
 * timeline, education, and training. A single `save()` call runs everything
 * inside ONE database transaction — Section 7 of the phase spec ("เมื่อกด Save
 * ทุกข้อมูล Save พร้อมกันครั้งเดียว") — so a partial failure never leaves the
 * officer with some sections updated and others not.
 *
 * Reuses the existing OfficerRepository/TimelineRepository/EducationRepository/
 * TrainingRepository exactly as-is (constructed over the transaction-scoped
 * client) — no duplicated data-access logic. Only sections present in the
 * input are touched; an omitted section is left completely unchanged.
 *
 * No OCR, no AI, no Gallery/ProfilePhoto coupling. Dependency-injected over a
 * DatabaseClient — no singleton, no globals.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { OfficerRepository } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository } from "@/lib/database/repositories/timeline_repository";
import { EducationRepository } from "@/lib/database/repositories/education_repository";
import { TrainingRepository } from "@/lib/database/repositories/training_repository";
import { normalizeTimelinePositionUnit } from "@/lib/import/timeline_normalization";
import {
  OfficerNotFoundError,
  type OfficerProfileSaveInput,
  type OfficerProfileSaveResult,
} from "@/lib/officer_profile/officer_profile_types";

export interface OfficerProfileServiceDependencies {
  db: DatabaseClient;
}

export class OfficerProfileService {
  private readonly db: DatabaseClient;

  constructor(dependencies: OfficerProfileServiceDependencies) {
    this.db = dependencies.db;
  }

  /**
   * Saves every section present in `input` for the given officer, atomically.
   * Throws OfficerNotFoundError if the officer doesn't exist (checked first,
   * before any write, so a bad id never partially writes anything).
   */
  async save(officerId: string, input: OfficerProfileSaveInput): Promise<OfficerProfileSaveResult> {
    return this.db.$transaction(async (tx) => {
      const officerRepo = new OfficerRepository(tx);
      const existing = await officerRepo.findByOfficerId(officerId);
      if (!existing) throw new OfficerNotFoundError(officerId);

      let profileUpdated = false;
      if (input.profile) {
        await officerRepo.updateProfile(officerId, input.profile);
        profileUpdated = true;
      }

      let timelineRowCount: number | null = null;
      if (input.timeline) {
        const timelineRepo = new TimelineRepository(tx);
        // Phase 23B: lazily normalize position/unit on save — a row whose
        // position embeds the unit (or duplicates it) is separated here before
        // persisting, so editing/saving an officer cleans up its mixed rows.
        const normalizedTimeline = input.timeline.map((row) => {
          const { position, unit } = normalizeTimelinePositionUnit({ position: row.position, unit: row.unit });
          return { ...row, position, unit };
        });
        timelineRowCount = await timelineRepo.replaceForOfficer(existing.id, normalizedTimeline);
      }

      let educationRowCount: number | null = null;
      if (input.education) {
        const educationRepo = new EducationRepository(tx);
        educationRowCount = await educationRepo.replaceForOfficer(existing.id, input.education);
      }

      let trainingRowCount: number | null = null;
      if (input.training) {
        const trainingRepo = new TrainingRepository(tx);
        trainingRowCount = await trainingRepo.replaceForOfficer(existing.id, input.training);
      }

      return { officerId, profileUpdated, timelineRowCount, educationRowCount, trainingRowCount };
    });
  }
}
