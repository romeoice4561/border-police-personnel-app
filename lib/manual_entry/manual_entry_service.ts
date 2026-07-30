/**
 * ManualEntryService (Phase XX — Manual Personnel Entry, Admin Only).
 *
 * The application layer for the admin-only Create Personnel form: runs
 * duplicate detection (blocking creation if any candidate matches — Section
 * 4 of the spec), generates a fresh manual/{uuid} officerId, creates the
 * Officer row with source="manual" and createdBy/createdByName stamped from
 * the acting admin, and (when an appointment date was supplied) seeds a
 * single Timeline row for it — all inside one transaction so a partial
 * failure never leaves a half-created officer.
 *
 * Reuses OfficerRepository/TimelineRepository exactly as-is (constructed over
 * the transaction-scoped client) — no duplicated data-access logic. No OCR,
 * no AI, no Google Drive coupling — this path is completely independent of
 * the import pipeline, per the spec's "ห้ามกระทบระบบ AI Import" constraint.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { OfficerRepository } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository } from "@/lib/database/repositories/timeline_repository";
import { findDuplicateCandidates } from "@/lib/manual_entry/duplicate_check";
import { generateManualOfficerId } from "@/lib/manual_entry/manual_entry_id";
import { ManualEntryDuplicateError, type ManualEntryCreateInput, type ManualEntryCreateResult } from "@/lib/manual_entry/manual_entry_types";

export interface ManualEntryServiceDependencies {
  db: DatabaseClient;
}

export class ManualEntryService {
  private readonly db: DatabaseClient;

  constructor(dependencies: ManualEntryServiceDependencies) {
    this.db = dependencies.db;
  }

  /**
   * Creates a new officer from a Manual Entry submission. Throws
   * ManualEntryDuplicateError (never creates anything) if the duplicate check
   * finds any candidate — the caller (API route) maps this to a 409 response
   * listing the candidates so the admin can decide what to do next.
   */
  async create(input: ManualEntryCreateInput): Promise<ManualEntryCreateResult> {
    // Duplicate check runs OUTSIDE the transaction (read-only, and we want to
    // fail fast before opening a write transaction at all).
    const candidates = await findDuplicateCandidates(this.db, {
      policeServiceNumber: input.policeServiceNumber ?? null,
      citizenId: input.citizenId ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth ?? null,
    });
    if (candidates.length > 0) throw new ManualEntryDuplicateError(candidates);

    const officerId = generateManualOfficerId();

    return this.db.$transaction(async (tx) => {
      const officerRepo = new OfficerRepository(tx);
      await officerRepo.create({
        officerId,
        rank: input.rank,
        firstName: input.firstName,
        lastName: input.lastName,
        nickname: input.nickname ?? null,
        policeServiceNumber: input.policeServiceNumber ?? null,
        citizenId: input.citizenId ?? null,
        academyClass: input.academyClass ?? null,
        currentPosition: input.currentPosition ?? null,
        currentUnit: input.currentUnit ?? null,
        region: input.region ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        employmentStatus: input.employmentStatus ?? null,
        source: "manual",
        createdBy: input.actorId,
        createdByName: input.actorName,
        updatedBy: input.actorId,
        updatedByName: input.actorName,
      });

      if (input.appointmentDate) {
        const officer = await officerRepo.findByOfficerId(officerId);
        if (officer) {
          const timelineRepo = new TimelineRepository(tx);
          await timelineRepo.replaceForOfficer(officer.id, [
            {
              sequence: 0,
              year: String(input.appointmentDate.getFullYear() + 543),
              yearValue: input.appointmentDate.getFullYear(),
              position: input.currentPosition || input.rank,
              unit: input.currentUnit ?? null,
              rank: input.rank,
              source: "เจ้าหน้าที่กรอก",
              verified: "unverified",
              effectiveDate: input.appointmentDate,
              isPresent: true,
            },
          ]);
        }
      }

      return { officerId };
    });
  }
}
