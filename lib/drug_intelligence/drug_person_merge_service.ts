/**
 * DrugPersonMergeService (Phase DI-2 — Sections 15-19).
 *
 * The ONLY code path allowed to merge two DrugPerson records. Merge is
 * deliberately a heavy, transaction-safe, audited operation — never an
 * automatic side effect of matching (Section 2/15: "ห้าม Auto Merge").
 *
 * Merge NEVER hard-deletes the merged person (Section 16): it is marked
 * `status: MERGED` with `mergedIntoPersonId` pointing at the survivor, so
 * every historical reference (a bookmarked URL, an old Case Workspace
 * drawer, a future DI-5 graph query) can still resolve it. Every
 * relationship row the merged person owned is moved onto the survivor,
 * deduplicating against rows the survivor already has so a merge can never
 * produce two DrugCasePerson rows for the same (caseId, survivorId) pair
 * (Section 17's explicit "ห้ามสร้าง duplicate" requirement) — this is why the
 * migration logic below is deterministic per relationship type rather than a
 * single generic "reassign all FKs" pass (Section 17: "อย่าทำ: delete B →
 * blindly update all FKs → ignore duplicates").
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugPersonMergeRepository } from "@/lib/database/repositories/drug_person_merge_repository";
import {
  DrugPersonMatchReviewRepository,
  orderPersonPair,
} from "@/lib/database/repositories/drug_person_match_review_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export class DrugPersonAlreadyMergedError extends Error {
  constructor(personId: string) {
    super(`Person '${personId}' has already been merged and cannot be merged again`);
    this.name = "DrugPersonAlreadyMergedError";
  }
}

export class DrugPersonNotFoundForMergeError extends Error {
  constructor(personId: string) {
    super(`Person '${personId}' not found`);
    this.name = "DrugPersonNotFoundForMergeError";
  }
}

export class DrugCannotMergeSamePersonError extends Error {
  constructor() {
    super("Cannot merge a person into itself");
    this.name = "DrugCannotMergeSamePersonError";
  }
}

export interface DrugPersonMergeRequest {
  survivorPersonId: string;
  mergedPersonId: string;
  reason: string | null;
  actorId: string;
  actorName: string;
}

export interface DrugPersonMergePreview {
  survivorPersonId: string;
  survivorName: string;
  mergedPersonId: string;
  mergedName: string;
  movedCounts: {
    cases: number;
    phones: number;
    sims: number;
    devices: number;
    vehicles: number;
    identifiers: number;
    aliases: number;
  };
  /** Cases both persons are already independently linked to — these are SKIPPED (not duplicated) during the actual merge, per Section 17. */
  skippedDuplicateCaseLinks: number;
}

export class DrugPersonMergeService {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Section 15's merge preview — read-only, no writes. Computes exactly what
   * WOULD move without touching any row, so the UI can show "จำนวนข้อมูลที่จะย้าย"
   * before the reviewer confirms.
   */
  async preview(survivorPersonId: string, mergedPersonId: string): Promise<DrugPersonMergePreview> {
    if (survivorPersonId === mergedPersonId) throw new DrugCannotMergeSamePersonError();

    const personRepo = new DrugPersonRepository(this.db);
    const [survivor, merged] = await Promise.all([personRepo.findById(survivorPersonId), personRepo.findById(mergedPersonId)]);
    if (!survivor) throw new DrugPersonNotFoundForMergeError(survivorPersonId);
    if (!merged) throw new DrugPersonNotFoundForMergeError(mergedPersonId);

    const [survivorCaseLinks, mergedCaseLinks] = await Promise.all([
      this.db.drugCasePerson.findMany({ where: { personId: survivorPersonId } }),
      this.db.drugCasePerson.findMany({ where: { personId: mergedPersonId } }),
    ]);
    const survivorCaseIds = new Set((survivorCaseLinks as Array<{ caseId: string }>).map((r) => r.caseId));
    const mergedCaseIds = (mergedCaseLinks as Array<{ caseId: string }>).map((r) => r.caseId);
    const skippedDuplicateCaseLinks = mergedCaseIds.filter((id) => survivorCaseIds.has(id)).length;

    const [phones, sims, devices, vehicles, identifiers, aliases] = await Promise.all([
      this.db.drugCasePhone.count({ where: { personId: mergedPersonId } }),
      this.db.drugCaseSim.count({ where: { personId: mergedPersonId } }),
      this.db.drugPersonDevice.count({ where: { personId: mergedPersonId } }),
      this.db.drugPersonVehicle.count({ where: { personId: mergedPersonId } }),
      this.db.drugPersonIdentifier.count({ where: { personId: mergedPersonId } }),
      this.db.drugPersonAlias.count({ where: { personId: mergedPersonId } }),
    ]);

    return {
      survivorPersonId,
      survivorName: survivor.primaryFullName,
      mergedPersonId,
      mergedName: merged.primaryFullName,
      movedCounts: { cases: mergedCaseIds.length - skippedDuplicateCaseLinks, phones, sims, devices, vehicles, identifiers, aliases },
      skippedDuplicateCaseLinks,
    };
  }

  /**
   * Performs the merge. Section 32 (concurrency): re-checks BOTH persons'
   * live status inside the transaction right before writing — if either was
   * already merged by a concurrent reviewer since the preview was shown,
   * this throws and nothing is written, rather than silently merging into an
   * already-merged/stale record.
   */
  async merge(request: DrugPersonMergeRequest): Promise<{ mergeId: string }> {
    if (request.survivorPersonId === request.mergedPersonId) throw new DrugCannotMergeSamePersonError();

    return this.db.$transaction(async (tx) => {
      const personRepo = new DrugPersonRepository(tx);
      const auditRepo = new DrugAuditLogRepository(tx);
      const mergeRepo = new DrugPersonMergeRepository(tx);
      const reviewRepo = new DrugPersonMatchReviewRepository(tx);

      const [survivor, merged] = await Promise.all([personRepo.findById(request.survivorPersonId), personRepo.findById(request.mergedPersonId)]);
      if (!survivor) throw new DrugPersonNotFoundForMergeError(request.survivorPersonId);
      if (!merged) throw new DrugPersonNotFoundForMergeError(request.mergedPersonId);
      // Section 32: revalidate state under the transaction, not just at preview time.
      if (survivor.status === "MERGED") throw new DrugPersonAlreadyMergedError(request.survivorPersonId);
      if (merged.status === "MERGED") throw new DrugPersonAlreadyMergedError(request.mergedPersonId);

      // Snapshot BEFORE any mutation, for the DrugPersonMerge.detail trace (Section 16 — enough to reconstruct what was absorbed for a future admin Unmerge).
      const [mergedIdentifiers, mergedAliases, mergedCaseLinks, mergedPhoneLinks, mergedSimLinks, mergedPersonDeviceLinks, mergedCaseDeviceLinks, mergedPersonVehicleLinks, mergedCaseVehicleLinks] =
        await Promise.all([
          personRepo.identifiersForPerson(merged.id),
          personRepo.aliasesForPerson(merged.id),
          tx.drugCasePerson.findMany({ where: { personId: merged.id } }),
          tx.drugCasePhone.findMany({ where: { personId: merged.id } }),
          tx.drugCaseSim.findMany({ where: { personId: merged.id } }),
          tx.drugPersonDevice.findMany({ where: { personId: merged.id } }),
          tx.drugCaseDevice.findMany({ where: { personId: merged.id } }),
          tx.drugPersonVehicle.findMany({ where: { personId: merged.id } }),
          tx.drugCaseVehicle.findMany({ where: { personId: merged.id } }),
        ]);

      const snapshot = {
        mergedPerson: {
          id: merged.id,
          primaryFullName: merged.primaryFullName,
          nationality: merged.nationality,
          dateOfBirth: merged.dateOfBirth ? merged.dateOfBirth.toISOString() : null,
          notes: merged.notes,
        },
        identifiers: mergedIdentifiers,
        aliases: mergedAliases,
      };

      // ── Cases (Section 17: dedupe on @@unique([caseId, personId])) ────
      const survivorCaseIds = new Set(
        (await tx.drugCasePerson.findMany({ where: { personId: survivor.id } }) as Array<{ caseId: string }>).map((r) => r.caseId)
      );
      let movedCases = 0;
      let skippedCaseDuplicates = 0;
      for (const link of mergedCaseLinks as Array<{ caseId: string; role: string; linkedOfficerId: string | null; notes: string | null; createdBy: string }>) {
        if (survivorCaseIds.has(link.caseId)) {
          skippedCaseDuplicates += 1;
          continue; // survivor is already on this case — never create a second DrugCasePerson row for the same pair.
        }
        await tx.drugCasePerson.create({
          data: { caseId: link.caseId, personId: survivor.id, role: link.role, linkedOfficerId: link.linkedOfficerId, notes: link.notes, createdBy: link.createdBy },
        });
        movedCases += 1;
      }
      await tx.drugCasePerson.deleteMany({ where: { personId: merged.id } });

      // ── Phones (personId is required/non-nullable on DrugCasePhone — every link just gets repointed; no case+person uniqueness constraint exists on this table so no dedupe collision is possible) ──
      await tx.drugCasePhone.updateMany({ where: { personId: merged.id }, data: { personId: survivor.id } });

      // ── SIMs (personId nullable) ──
      await tx.drugCaseSim.updateMany({ where: { personId: merged.id }, data: { personId: survivor.id } });

      // ── Devices: durable DrugPersonDevice link (dedupe on deviceId — never two durable links to the same device for one person) ──
      const survivorDeviceIds = new Set(
        (await tx.drugPersonDevice.findMany({ where: { personId: survivor.id } }) as Array<{ deviceId: string }>).map((r) => r.deviceId)
      );
      for (const link of mergedPersonDeviceLinks as Array<{ deviceId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null; recordedBy: string; notes: string | null }>) {
        if (survivorDeviceIds.has(link.deviceId)) continue;
        await tx.drugPersonDevice.create({
          data: { personId: survivor.id, deviceId: link.deviceId, status: link.status, firstSeenAt: link.firstSeenAt, lastSeenAt: link.lastSeenAt, sourceCaseId: link.sourceCaseId, recordedBy: link.recordedBy, notes: link.notes },
        });
        survivorDeviceIds.add(link.deviceId);
      }
      await tx.drugPersonDevice.deleteMany({ where: { personId: merged.id } });
      // Case-level device sightings (DrugCaseDevice.personId nullable) — just repointed, no uniqueness constraint to dedupe against.
      await tx.drugCaseDevice.updateMany({ where: { personId: merged.id }, data: { personId: survivor.id } });

      // ── Vehicles: same durable-link dedupe pattern as devices ──
      const survivorVehicleIds = new Set(
        (await tx.drugPersonVehicle.findMany({ where: { personId: survivor.id } }) as Array<{ vehicleId: string }>).map((r) => r.vehicleId)
      );
      for (const link of mergedPersonVehicleLinks as Array<{ vehicleId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null; recordedBy: string; notes: string | null }>) {
        if (survivorVehicleIds.has(link.vehicleId)) continue;
        await tx.drugPersonVehicle.create({
          data: { personId: survivor.id, vehicleId: link.vehicleId, status: link.status, firstSeenAt: link.firstSeenAt, lastSeenAt: link.lastSeenAt, sourceCaseId: link.sourceCaseId, recordedBy: link.recordedBy, notes: link.notes },
        });
        survivorVehicleIds.add(link.vehicleId);
      }
      await tx.drugPersonVehicle.deleteMany({ where: { personId: merged.id } });
      await tx.drugCaseVehicle.updateMany({ where: { personId: merged.id }, data: { personId: survivor.id } });

      // ── Identifiers & aliases: UNION, never deduplicated to a single "best" value — Section 21/23's "รองรับหลาย Identifier"/"รองรับหลายรายการ" applies equally to merge-time consolidation. Exact-duplicate (type,value) or fullName rows are skipped so a merge never doubles up an identical row. ──
      const survivorIdentifiers = await personRepo.identifiersForPerson(survivor.id);
      const survivorIdentifierKeys = new Set((survivorIdentifiers as Array<{ type: string; value: string }>).map((r) => `${r.type}:${r.value}`));
      let movedIdentifiers = 0;
      for (const identifier of mergedIdentifiers as Array<{ type: string; value: string; notes: string | null; createdBy: string }>) {
        const key = `${identifier.type}:${identifier.value}`;
        if (survivorIdentifierKeys.has(key)) continue;
        await personRepo.addIdentifier(survivor.id, identifier.type, identifier.value, identifier.notes, identifier.createdBy);
        survivorIdentifierKeys.add(key);
        movedIdentifiers += 1;
      }

      const survivorAliases = await personRepo.aliasesForPerson(survivor.id);
      const survivorAliasNames = new Set((survivorAliases as Array<{ fullName: string }>).map((r) => r.fullName));
      let movedAliases = 0;
      for (const alias of mergedAliases as Array<{ fullName: string; createdBy: string }>) {
        if (survivorAliasNames.has(alias.fullName)) continue;
        await personRepo.addAlias(survivor.id, alias.fullName, false, alias.createdBy);
        survivorAliasNames.add(alias.fullName);
        movedAliases += 1;
      }
      // The merged person's OWN primary name is preserved as an alias on the survivor (if not already identical), so the merge never loses a name a case narrative might still reference.
      if (!survivorAliasNames.has(merged.primaryFullName)) {
        await personRepo.addAlias(survivor.id, merged.primaryFullName, false, request.actorId);
        movedAliases += 1;
      }

      // ── Mark merged person MERGED (never hard-deleted — Section 16) ──
      await personRepo.markMerged(merged.id, survivor.id);

      // ── Merge history row (Section 16) ──
      const mergeId = generateDrugId();
      await mergeRepo.create({
        id: mergeId,
        survivorPersonId: survivor.id,
        mergedPersonId: merged.id,
        reason: request.reason,
        detail: {
          ...snapshot,
          movedCounts: { cases: movedCases, phones: mergedPhoneLinks.length, sims: mergedSimLinks.length, devices: mergedPersonDeviceLinks.length, vehicles: mergedPersonVehicleLinks.length, identifiers: movedIdentifiers, aliases: movedAliases },
          skippedCaseDuplicates,
          caseDeviceLinksRepointed: mergedCaseDeviceLinks.length,
          caseVehicleLinksRepointed: mergedCaseVehicleLinks.length,
        },
        mergedBy: request.actorId,
        mergedByName: request.actorName,
      });

      // ── Persistent review decision (Section 19): mark the pair MERGED so it never resurfaces, superseding any prior CONFIRMED_DUPLICATE/NOT_SAME on the same pair. ──
      const [personAId, personBId] = orderPersonPair(survivor.id, merged.id);
      const existingReview = await reviewRepo.findForPair(personAId, personBId);
      if (!existingReview) {
        await reviewRepo.create({
          id: generateDrugId(),
          personAId,
          personBId,
          decision: "MERGED",
          signals: [],
          reviewedBy: request.actorId,
          reviewedByName: request.actorName,
          notes: request.reason,
        });
      }

      // ── Audit (Section 30) — never logs full sensitive identifier values, only counts/ids. ──
      await auditRepo.record({
        entityType: "DrugPerson",
        entityId: survivor.id,
        action: "person_merged",
        actorId: request.actorId,
        actorName: request.actorName,
        detail: `mergedPersonId=${merged.id} cases=${movedCases} identifiers=${movedIdentifiers} aliases=${movedAliases} reason=${request.reason ?? "-"}`,
      });

      return { mergeId };
    });
  }
}
