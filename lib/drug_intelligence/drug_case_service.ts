/**
 * DrugCaseService (Phase DI-1 — Drug Intelligence Core Data Model & Case
 * Workspace).
 *
 * The application layer for creating a Drug Intelligence case: validates
 * duplicate-safety for every NEW person (Section 14 — blocks creation,
 * never merges), then writes the case, its persons (linking to an existing
 * DrugPerson when the caller already resolved a duplicate, or creating a
 * fresh one otherwise), their phones/devices/vehicles (find-or-create the
 * entity, always create a fresh case-link row carrying provenance —
 * Section 12), seized items, and locations — all inside ONE transaction so
 * a partial failure never leaves a half-created case (mirrors
 * OfficerProfileService.save's transactional convention exactly).
 *
 * Every write in this module is also mirrored into DrugAuditLog (Section
 * 21) — case create, person add, phone add, device add, identifier add —
 * inside the SAME transaction, so the audit trail can never disagree with
 * what was actually persisted.
 *
 * No OCR, no AI, no Google Drive coupling — this module is completely
 * independent of the Personnel import pipeline (Section 22's constraint
 * extends naturally: nothing here touches lib/import/* or the Telegram
 * bot). Dependency-injected over a DatabaseClient — no singleton, no globals.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugNetworkGroupRepository } from "@/lib/database/repositories/drug_network_group_repository";
import { DrugPersonNetworkRoleRepository } from "@/lib/database/repositories/drug_person_network_role_repository";
import { DrugCaseParticipatingUnitRepository } from "@/lib/database/repositories/drug_case_participating_unit_repository";
import { DrugCaseOfficerRepository } from "@/lib/database/repositories/drug_case_officer_repository";
import { findDrugPersonDuplicateCandidates } from "@/lib/drug_intelligence/drug_duplicate_check";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";
import {
  DrugDuplicatePersonError,
  DrugCaseNotFoundError,
  DrugPersonNotFoundError,
  type DrugCaseCreateRequest,
  type DrugCaseCreateResult,
} from "@/lib/drug_intelligence/drug_case_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import { filterCasesByCompleteness } from "@/lib/drug_intelligence/drug_case_completeness";

export interface DrugCaseServiceDependencies {
  db: DatabaseClient;
}

export class DrugCaseService {
  private readonly db: DatabaseClient;

  constructor(dependencies: DrugCaseServiceDependencies) {
    this.db = dependencies.db;
  }

  /**
   * Creates a new case from a Create Case submission. Runs duplicate
   * checks for every NEW person (not `existingPersonId` selections) BEFORE
   * opening the transaction — a duplicate anywhere blocks the ENTIRE
   * submission (Section 14: "หากพบข้อมูลซ้ำ ให้แจ้งเตือนและไม่สร้างโปรไฟล์ใหม่"),
   * never partially creates a case with some persons linked and others
   * rejected.
   */
  async createCase(input: DrugCaseCreateRequest): Promise<DrugCaseCreateResult> {
    for (let i = 0; i < input.persons.length; i++) {
      const person = input.persons[i];
      if (person.existingPersonId) continue;
      if (!person.newPerson) continue;

      const candidates = await findDrugPersonDuplicateCandidates(this.db, {
        identifiers: person.newPerson.identifiers,
        primaryFullName: person.newPerson.primaryFullName,
        dateOfBirth: person.newPerson.dateOfBirth,
      });
      if (candidates.length > 0) throw new DrugDuplicatePersonError(i, candidates);
    }

    const caseId = generateDrugId();

    return this.db.$transaction(async (tx) => {
      const caseRepo = new DrugCaseRepository(tx);
      const casePersonRepo = new DrugCasePersonRepository(tx);
      const personRepo = new DrugPersonRepository(tx);
      const entityRepo = new DrugEntityRepository(tx);
      const auditRepo = new DrugAuditLogRepository(tx);

      await caseRepo.create({
        id: caseId,
        caseNumber: input.caseNumber,
        title: input.title,
        status: input.status,
        arrestDate: input.arrestDate,
        arrestTime: input.arrestTime,
        headquartersId: input.headquartersId,
        regionId: input.regionId,
        battalionId: input.battalionId,
        companyId: input.companyId,
        reportingUnitText: input.reportingUnitText,
        leadHeadquartersId: input.leadHeadquartersId ?? null,
        leadRegionId: input.leadRegionId ?? null,
        leadBattalionId: input.leadBattalionId ?? null,
        leadCompanyId: input.leadCompanyId ?? null,
        leadUnitText: input.leadUnitText ?? null,
        province: input.province,
        district: input.district,
        subdistrict: input.subdistrict,
        locationName: input.locationName,
        latitude: input.latitude,
        longitude: input.longitude,
        narrative: input.narrative,
        createdBy: input.actorId,
        createdByName: input.actorName,
      });
      await auditRepo.record({
        entityType: "DrugCase",
        entityId: caseId,
        action: "case_created",
        actorId: input.actorId,
        actorName: input.actorName,
        detail: `caseNumber=${input.caseNumber}`,
      });

      // Phase DI-7.6: หน่วยจับกุมหลัก is recorded on the DrugCase row itself
      // (above) — a single audit entry captures that assignment as part of
      // case creation, distinct from "participating unit" entries below.
      if (input.leadHeadquartersId || input.leadRegionId || input.leadBattalionId || input.leadCompanyId || input.leadUnitText) {
        await auditRepo.record({
          entityType: "DrugCase",
          entityId: caseId,
          action: "arrest_unit_set",
          actorId: input.actorId,
          actorName: input.actorName,
          detail: input.leadUnitText ? `manual=${input.leadUnitText}` : `companyId=${input.leadCompanyId} battalionId=${input.leadBattalionId} regionId=${input.leadRegionId} headquartersId=${input.leadHeadquartersId}`,
        });
      }

      const participatingUnitRepo = new DrugCaseParticipatingUnitRepository(tx);
      for (const unit of input.participatingUnits ?? []) {
        const created = await participatingUnitRepo.create({
          caseId,
          headquartersId: unit.headquartersId,
          regionId: unit.regionId,
          battalionId: unit.battalionId,
          companyId: unit.companyId,
          unitText: unit.unitText,
          role: unit.role,
          note: unit.note,
          createdBy: input.actorId,
          createdByName: input.actorName,
        });
        await auditRepo.record({
          entityType: "DrugCaseParticipatingUnit",
          entityId: created.id,
          action: "participating_unit_added",
          actorId: input.actorId,
          actorName: input.actorName,
          detail: `case=${caseId} role=${unit.role}`,
        });
      }

      const caseOfficerRepo = new DrugCaseOfficerRepository(tx);
      for (const officer of input.officers ?? []) {
        const created = await caseOfficerRepo.create({
          caseId,
          officerId: officer.officerId,
          manualRank: officer.manualRank,
          manualFullName: officer.manualFullName,
          manualPosition: officer.manualPosition,
          manualUnitText: officer.manualUnitText,
          role: officer.role,
          note: officer.note,
          createdBy: input.actorId,
          createdByName: input.actorName,
        });
        await auditRepo.record({
          entityType: "DrugCaseOfficer",
          entityId: created.id,
          action: "case_officer_added",
          actorId: input.actorId,
          actorName: input.actorName,
          detail: `case=${caseId} role=${officer.role}`,
        });
      }

      for (const personInput of input.persons) {
        let personId: string;

        if (personInput.existingPersonId) {
          const existing = await personRepo.findById(personInput.existingPersonId);
          if (!existing) throw new Error(`Referenced existing person '${personInput.existingPersonId}' not found`);
          personId = existing.id;
        } else if (personInput.newPerson) {
          personId = generateDrugId();
          await personRepo.create({
            id: personId,
            primaryFullName: personInput.newPerson.primaryFullName,
            nickname: personInput.newPerson.nickname ?? null,
            nationality: personInput.newPerson.nationality,
            sex: personInput.newPerson.sex ?? null,
            dateOfBirth: personInput.newPerson.dateOfBirth,
            approximateAge: personInput.newPerson.approximateAge ?? null,
            notes: personInput.newPerson.notes,
            createdBy: input.actorId,
            createdByName: input.actorName,
          });
          await personRepo.addAlias(personId, personInput.newPerson.primaryFullName, true, input.actorId);
          // DI-7.1 fix: secondary aliases (DrugPersonAlias rows, isPrimary=false)
          for (const alias of (personInput.newPerson.aliases ?? [])) {
            const name = alias.fullName.trim();
            if (!name) continue;
            await personRepo.addAlias(personId, name, false, input.actorId);
          }
          for (const identifier of personInput.newPerson.identifiers) {
            if (!identifier.value.trim()) continue;
            await personRepo.addIdentifier(personId, identifier.type, identifier.value.trim(), identifier.notes, input.actorId);
          }

          // DI-7.3: persist network-role assertions
          const networkRoleRepo = new DrugPersonNetworkRoleRepository(tx);
          for (const nr of (personInput.newPerson.networkRoles ?? [])) {
            if (!nr.role.trim()) continue;
            await networkRoleRepo.create({
              personId,
              sourceCaseId: caseId,
              role: nr.role.trim(),
              source: nr.source,
              verificationStatus: nr.verificationStatus ?? "UNVERIFIED",
              note: nr.note,
              createdBy: input.actorId,
              createdByName: input.actorName,
            });
            await auditRepo.record({
              entityType: "DrugPersonNetworkRole",
              entityId: personId,
              action: "network_role_asserted",
              actorId: input.actorId,
              actorName: input.actorName,
              detail: `role=${nr.role} source=${nr.source ?? "UNKNOWN"} status=${nr.verificationStatus ?? "UNVERIFIED"}`,
            });
          }

          // DI-7.2: persist network/group memberships
          const networkGroupRepo = new DrugNetworkGroupRepository(tx);
          for (const nm of (personInput.newPerson.networkMemberships ?? [])) {
            let groupId = nm.networkGroupId;
            if (!groupId && nm.networkGroupName.trim()) {
              // Find by name first (case-insensitive simple match)
              const all = await networkGroupRepo.findAll();
              const found = all.find((g) => g.name.toLowerCase() === nm.networkGroupName.trim().toLowerCase());
              if (found) {
                groupId = found.id;
              } else {
                // Create new group only if no canonical record exists
                const newGroup = await networkGroupRepo.create({
                  name: nm.networkGroupName.trim(),
                  aliases: null,
                  description: null,
                  note: null,
                  createdBy: input.actorId,
                });
                groupId = newGroup.id;
                await auditRepo.record({
                  entityType: "DrugNetworkGroup",
                  entityId: groupId,
                  action: "network_group_created",
                  actorId: input.actorId,
                  actorName: input.actorName,
                  detail: `name=${nm.networkGroupName.trim()}`,
                });
              }
            }
            if (!groupId) continue;
            await networkGroupRepo.addMembership({
              personId,
              networkGroupId: groupId,
              source: nm.source,
              status: null,
              note: nm.note,
              firstObservedAt: null,
              lastObservedAt: null,
              createdBy: input.actorId,
            });
            await auditRepo.record({
              entityType: "DrugPersonNetworkMembership",
              entityId: personId,
              action: "network_membership_added",
              actorId: input.actorId,
              actorName: input.actorName,
              detail: `group=${groupId}`,
            });
          }

          await auditRepo.record({
            entityType: "DrugPerson",
            entityId: personId,
            action: "person_created",
            actorId: input.actorId,
            actorName: input.actorName,
            detail: `via case ${caseId}`,
          });
        } else {
          continue;
        }

        await casePersonRepo.create({
          caseId,
          personId,
          role: personInput.role,
          linkedOfficerId: personInput.linkedOfficerId,
          notes: personInput.notes,
          createdBy: input.actorId,
        });
        await auditRepo.record({
          entityType: "DrugCasePerson",
          entityId: personId,
          action: "person_added_to_case",
          actorId: input.actorId,
          actorName: input.actorName,
          detail: `case=${caseId} role=${personInput.role}`,
        });

        for (const phone of personInput.phones) {
          const normalizedNumber = normalizePhoneMatchingKey(phone.rawInput);
          if (!normalizedNumber) continue;
          const phoneEntity = await entityRepo.findOrCreatePhoneNumber(normalizedNumber, input.actorId);
          await entityRepo.linkCasePhone({
            caseId,
            personId,
            phoneNumberId: phoneEntity.id,
            originalInput: phone.rawInput,
            status: "REPORTED",
            firstSeenAt: phone.firstSeenAt,
            lastSeenAt: phone.lastSeenAt,
            recordedBy: input.actorId,
            notes: phone.notes,
          });
          await auditRepo.record({
            entityType: "DrugPhoneNumber",
            entityId: phoneEntity.id,
            action: "phone_added",
            actorId: input.actorId,
            actorName: input.actorName,
            detail: `case=${caseId} person=${personId}`,
          });
        }

        for (const sim of personInput.sims) {
          if (!sim.iccid && !sim.imsi) continue;
          const simEntity = await entityRepo.findOrCreateSim({
            iccid: sim.iccid,
            imsi: sim.imsi,
            carrier: sim.carrier,
            createdBy: input.actorId,
          });
          await entityRepo.linkCaseSim({
            caseId,
            personId,
            simId: simEntity.id,
            status: "REPORTED",
            firstSeenAt: sim.firstSeenAt,
            lastSeenAt: sim.lastSeenAt,
            recordedBy: input.actorId,
            notes: sim.notes,
          });
          await auditRepo.record({
            entityType: "DrugSim",
            entityId: simEntity.id,
            action: "sim_added",
            actorId: input.actorId,
            actorName: input.actorName,
            detail: `case=${caseId} person=${personId}`,
          });
        }

        for (const device of personInput.devices) {
          if (!device.imei1 && !device.imei2 && !device.serialNumber) continue;
          const deviceEntity = await entityRepo.findOrCreateDevice({
            brand: device.brand,
            model: device.model,
            serialNumber: device.serialNumber,
            imei1: device.imei1,
            imei2: device.imei2,
            createdBy: input.actorId,
          });
          await entityRepo.linkPersonDevice({
            personId,
            deviceId: deviceEntity.id,
            status: "REPORTED",
            firstSeenAt: device.firstSeenAt,
            lastSeenAt: device.lastSeenAt,
            sourceCaseId: caseId,
            recordedBy: input.actorId,
            notes: device.notes,
          });
          await entityRepo.linkCaseDevice({
            caseId,
            personId,
            deviceId: deviceEntity.id,
            status: "REPORTED",
            recordedBy: input.actorId,
            notes: device.notes,
          });
          await auditRepo.record({
            entityType: "DrugDevice",
            entityId: deviceEntity.id,
            action: "device_added",
            actorId: input.actorId,
            actorName: input.actorName,
            detail: `case=${caseId} person=${personId}`,
          });
        }

        for (const vehicle of personInput.vehicles) {
          if (!vehicle.registrationNumber && !vehicle.vin) continue;
          const vehicleEntity = await entityRepo.findOrCreateVehicle({
            registrationNumber: vehicle.registrationNumber,
            registrationProvince: vehicle.registrationProvince,
            vehicleType: vehicle.vehicleType,
            brand: vehicle.brand,
            model: vehicle.model,
            color: vehicle.color,
            vin: vehicle.vin,
            createdBy: input.actorId,
          });
          await entityRepo.linkPersonVehicle({
            personId,
            vehicleId: vehicleEntity.id,
            status: "REPORTED",
            firstSeenAt: vehicle.firstSeenAt,
            lastSeenAt: vehicle.lastSeenAt,
            sourceCaseId: caseId,
            recordedBy: input.actorId,
            notes: vehicle.notes,
          });
          await entityRepo.linkCaseVehicle({
            caseId,
            personId,
            vehicleId: vehicleEntity.id,
            status: "REPORTED",
            recordedBy: input.actorId,
            notes: vehicle.notes,
          });
        }
      }

      for (const item of input.seizedItems) {
        await entityRepo.addSeizedItem({ caseId, ...item, createdBy: input.actorId });
      }

      for (const location of input.locations) {
        const locationEntity = await entityRepo.createLocation({
          name: location.name,
          addressText: location.addressText,
          province: location.province,
          district: location.district,
          subdistrict: location.subdistrict,
          latitude: location.latitude,
          longitude: location.longitude,
          createdBy: input.actorId,
        });
        await entityRepo.linkCaseLocation({
          caseId,
          locationId: locationEntity.id,
          role: location.role,
          recordedBy: input.actorId,
          notes: location.notes,
        });
      }

      return { caseId };
    });
  }

  /**
   * Section 18's Case Workspace: the full case plus every linked entity,
   * resolved to display-ready rows (person names, phone numbers, device
   * brand/IMEI, vehicle plate, location name/role, seized-item lines) — not
   * just counts. Every row keeps its own provenance fields (status/
   * firstSeenAt/lastSeenAt/recordedBy) exactly as stored, so the workspace
   * can render Section 12's "never presented as confirmed" rule directly
   * from the data rather than re-deriving it.
   */
  async getCase(caseId: string) {
    const caseRepo = new DrugCaseRepository(this.db);
    const drugCase = await caseRepo.findById(caseId);
    if (!drugCase) throw new DrugCaseNotFoundError(caseId);

    const casePersonRepo = new DrugCasePersonRepository(this.db);
    const personRepo = new DrugPersonRepository(this.db);
    const entityRepo = new DrugEntityRepository(this.db);

    const [casePersonLinks, casePhoneLinks, caseSimLinks, caseDeviceLinks, caseVehicleLinks, seizedItems, caseLocationLinks] = await Promise.all([
      casePersonRepo.forCase(caseId),
      caseRepo.casePhonesForCase(caseId),
      caseRepo.caseSimsForCase(caseId),
      caseRepo.caseDevicesForCase(caseId),
      caseRepo.caseVehiclesForCase(caseId),
      caseRepo.seizedItemsForCase(caseId),
      caseRepo.caseLocationsForCase(caseId),
    ]);

    // One lookup per distinct person referenced anywhere on this case (as a
    // case subject OR as the person a phone/device/vehicle was linked
    // through) — small, bounded set at DI-1's expected case size.
    const personIds = new Set<string>();
    for (const link of casePersonLinks) personIds.add(link.personId);
    for (const link of casePhoneLinks) personIds.add(link.personId);
    for (const link of caseSimLinks) if (link.personId) personIds.add(link.personId);
    for (const link of caseDeviceLinks) if (link.personId) personIds.add(link.personId);
    for (const link of caseVehicleLinks) if (link.personId) personIds.add(link.personId);
    const personEntries = await Promise.all([...personIds].map((id) => personRepo.findById(id)));
    const personById = new Map(personEntries.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]));

    const persons = casePersonLinks.map((link) => ({
      ...link,
      person: personById.get(link.personId) ?? null,
    }));

    const phones = await Promise.all(
      casePhoneLinks.map(async (link) => ({
        ...link,
        phoneNumber: await entityRepo.findPhoneNumberById(link.phoneNumberId),
        person: personById.get(link.personId) ?? null,
      }))
    );

    const sims = await Promise.all(
      caseSimLinks.map(async (link) => ({
        ...link,
        person: link.personId ? (personById.get(link.personId) ?? null) : null,
      }))
    );

    const devices = await Promise.all(
      caseDeviceLinks.map(async (link) => ({
        ...link,
        device: await entityRepo.findDeviceById(link.deviceId),
        person: link.personId ? (personById.get(link.personId) ?? null) : null,
      }))
    );

    const vehicles = await Promise.all(
      caseVehicleLinks.map(async (link) => ({
        ...link,
        vehicle: await entityRepo.findVehicleById(link.vehicleId),
        person: link.personId ? (personById.get(link.personId) ?? null) : null,
      }))
    );

    const locations = await Promise.all(
      caseLocationLinks.map(async (link) => ({
        ...link,
        location: await entityRepo.findLocationById(link.locationId),
      }))
    );

    // Phase DI-7.6: หน่วยและชุดจับกุม — participating units are display-ready
    // as-is (unitText IS the stored column, same reportingUnitText
    // convention — no server-side derivation). Officers batch-resolve their
    // canonical Officer summary (internal rows only — manual/external rows
    // have officerId=null and stay null here, rendered from their manual*
    // fields instead).
    const participatingUnitRepo = new DrugCaseParticipatingUnitRepository(this.db);
    const caseOfficerRepo = new DrugCaseOfficerRepository(this.db);
    const [participatingUnits, caseOfficerRows] = await Promise.all([
      participatingUnitRepo.forCase(caseId),
      caseOfficerRepo.forCase(caseId),
    ]);

    const internalOfficerIds = [...new Set(caseOfficerRows.map((row) => row.officerId).filter((id): id is string => id !== null))];
    const officerEntries = await Promise.all(internalOfficerIds.map((id) => this.db.officer.findUnique({ where: { officerId: id } })));
    const officerByOfficerId = new Map(
      officerEntries
        .filter((o): o is NonNullable<typeof o> => o !== null)
        .map((o) => [o.officerId, { officerId: o.officerId, rank: o.rank, firstName: o.firstName, lastName: o.lastName, currentUnit: o.currentUnit }])
    );
    const officers = caseOfficerRows.map((row) => ({
      ...row,
      officer: row.officerId ? (officerByOfficerId.get(row.officerId) ?? null) : null,
    }));

    return {
      case: drugCase,
      persons,
      phones,
      sims,
      devices,
      vehicles,
      seizedItems,
      locations,
      participatingUnits,
      officers,
      personCount: persons.length,
      phoneCount: phones.length,
      simCount: sims.length,
      deviceCount: devices.length,
      vehicleCount: vehicles.length,
      seizedItemCount: seizedItems.length,
    };
  }

  /**
   * Section 16's list page. Each row is enriched with its person/seized-item
   * counts (the list's "persons count" / "drug summary" columns) via the
   * same per-case count queries getCase uses — acceptable N+1 at DI-1's
   * expected case volume; a future phase can batch this if the list grows
   * large enough to matter.
   */
  async listCases(params: {
    page: number;
    pageSize: number;
    query?: string;
    caseNumber?: string;
    status?: string;
    province?: string;
    headquartersId?: number;
    regionId?: number;
    battalionId?: number;
    companyId?: number;
    arrestDateFrom?: Date;
    arrestDateTo?: Date;
    leadHeadquartersId?: number;
    leadRegionId?: number;
    leadBattalionId?: number;
    leadCompanyId?: number;
    /**
     * Phase DI-7.6 Section 13: these three require joining
     * DrugCaseParticipatingUnit/DrugCaseOfficer, which DrugCaseRepository.list()
     * cannot express (it only queries DrugCase's own columns) — resolved here
     * as a caseId allow-list applied AFTER pagination-free base fetch, same
     * "resolve matching ids first, then filter" shape DrugCaseRepository's
     * own findCaseIdsMatchingQuery uses for the free-text search box.
     */
    participatingUnitCompanyId?: number;
    officerId?: string;
    officerRole?: string;
    completeness?: import("@/lib/drug_intelligence/drug_case_completeness").CaseCompletenessFilter;
    unitGroup?: import("@/lib/drug_intelligence/drug_commander_filter").CommanderUnitGroupBy;
  }) {
    const caseRepo = new DrugCaseRepository(this.db);
    const {
      leadHeadquartersId,
      leadRegionId,
      leadBattalionId,
      leadCompanyId,
      participatingUnitCompanyId,
      officerId,
      officerRole,
      completeness,
      unitGroup,
      ...baseParams
    } = params;
    const { rows: allMatchingRows, total: baseTotal } = await caseRepo.list({
      ...baseParams,
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
      leadHeadquartersId,
      leadRegionId,
      leadBattalionId,
      leadCompanyId,
    });

    let filteredRows = allMatchingRows;
    if (participatingUnitCompanyId !== undefined) {
      const participatingUnitRepo = new DrugCaseParticipatingUnitRepository(this.db);
      const matches = await Promise.all(
        filteredRows.map(async (row) => {
          const units = await participatingUnitRepo.forCase(row.id);
          return units.some((u) => u.companyId === participatingUnitCompanyId);
        })
      );
      filteredRows = filteredRows.filter((_, i) => matches[i]);
    }
    if (officerId !== undefined || officerRole !== undefined) {
      const caseOfficerRepo = new DrugCaseOfficerRepository(this.db);
      const matches = await Promise.all(
        filteredRows.map(async (row) => {
          const officers = await caseOfficerRepo.forCase(row.id);
          return officers.some((o) => (officerId === undefined || o.officerId === officerId) && (officerRole === undefined || o.role === officerRole));
        })
      );
      filteredRows = filteredRows.filter((_, i) => matches[i]);
    }
    if (completeness) {
      filteredRows = await filterCasesByCompleteness(this.db, filteredRows, completeness, unitGroup ?? "battalion");
    }

    const total = filteredRows.length === allMatchingRows.length ? baseTotal : filteredRows.length;
    const start = (params.page - 1) * params.pageSize;
    const pageRows = filteredRows.slice(start, start + params.pageSize);

    const enriched = await Promise.all(
      pageRows.map(async (row) => {
        const [personCount, seizedItems] = await Promise.all([
          caseRepo.countPersonsForCase(row.id),
          caseRepo.seizedItemsForCase(row.id),
        ]);
        return { ...row, personCount, seizedItemCount: seizedItems.length, seizedItemsSummary: summarizeSeizedItems(seizedItems) };
      })
    );

    return { rows: enriched, total };
  }

  /**
   * Section 8's real-time duplicate check — callable BEFORE final submit
   * (e.g. on blur of the identifier field in the Create Case form), reusing
   * the exact same candidate logic createCase() enforces at submit time, so
   * the warning the user sees while typing can never disagree with what
   * actually blocks the save.
   */
  async checkPersonDuplicate(input: {
    identifiers: Array<{ type: string; value: string }>;
    primaryFullName: string;
    dateOfBirth: Date | null;
  }) {
    return findDrugPersonDuplicateCandidates(this.db, input);
  }

  /** Section 9's real-time "พบหมายเลขนี้ในระบบแล้ว" reuse indicator — existence-only, never blocks. */
  async checkPhoneExists(rawInput: string) {
    const normalizedNumber = normalizePhoneMatchingKey(rawInput);
    if (!normalizedNumber) return null;
    const entityRepo = new DrugEntityRepository(this.db);
    return entityRepo.findPhoneNumberByNormalized(normalizedNumber);
  }

  /** Section 10's real-time "พบ IMEI นี้ในข้อมูลเดิม" reuse indicator — existence-only, never blocks. */
  async checkDeviceExists(imei1: string | null, serialNumber: string | null) {
    const entityRepo = new DrugEntityRepository(this.db);
    return entityRepo.findDeviceByImeiOrSerial(imei1, serialNumber);
  }

  /**
   * Section 18's Person Detail Drawer: name, aliases, identifiers (raw
   * values — masking is a PRESENTATION concern, applied client-side via
   * lib/drug_intelligence/drug_sensitive_presentation.ts per the viewer's
   * permission, never stripped server-side), case count, phones (across all
   * cases), devices, vehicles. This is NOT a full DI-2 Person Profile —
   * no case history detail, no cross-entity graph, just the drawer's
   * declared field list.
   */
  async getPersonDetail(personId: string) {
    const personRepo = new DrugPersonRepository(this.db);
    const person = await personRepo.findById(personId);
    if (!person) throw new DrugPersonNotFoundError(personId);

    const casePersonRepo = new DrugCasePersonRepository(this.db);
    const entityRepo = new DrugEntityRepository(this.db);

    const [aliases, identifiers, caseLinks, phoneLinks, deviceLinks, vehicleLinks] = await Promise.all([
      personRepo.aliasesForPerson(personId),
      personRepo.identifiersForPerson(personId),
      casePersonRepo.forPerson(personId),
      personRepo.casePhonesForPerson(personId),
      entityRepo.personDevicesForPerson(personId),
      entityRepo.personVehiclesForPerson(personId),
    ]);

    const phones = await Promise.all(
      phoneLinks.map(async (link) => ({ ...link, phoneNumber: await entityRepo.findPhoneNumberById(link.phoneNumberId) }))
    );
    const devices = await Promise.all(deviceLinks.map(async (link) => ({ ...link, device: await entityRepo.findDeviceById(link.deviceId) })));
    const vehicles = await Promise.all(vehicleLinks.map(async (link) => ({ ...link, vehicle: await entityRepo.findVehicleById(link.vehicleId) })));

    return {
      person,
      aliases,
      identifiers,
      caseCount: caseLinks.length,
      phones,
      devices,
      vehicles,
    };
  }
}

/**
 * Section 12's Case Workspace/list summary format: "ยาบ้า 20,000 เม็ด • ไอซ์
 * 2.4 กก." — groups by drugType, formats using the row's canonical
 * `measurementKind` (Phase DI-3.1) rather than inferring COUNT-vs-MASS from
 * whether `unit` happens to be set — the ambiguity that inference carried
 * is exactly the gap DI-3.1 closed. Pure presentation — no analytics, no
 * derived intelligence (Section 12: "ไม่ต้อง ทำ analytics ใน DI-1").
 */
function summarizeSeizedItems(items: Array<{ drugType: string; measurementKind: string; quantity: unknown; unit: string | null; weightGrams: unknown }>): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  for (const item of items) {
    const quantity = item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : null;
    const weightGrams = item.weightGrams !== null && item.weightGrams !== undefined ? Number(item.weightGrams) : null;
    if (item.measurementKind === "COUNT" && quantity !== null) {
      parts.push(`${item.drugType} ${quantity.toLocaleString("th-TH")}${item.unit ? ` ${item.unit}` : ""}`);
    } else if (item.measurementKind === "MASS" && weightGrams !== null) {
      const kg = weightGrams / 1000;
      parts.push(`${item.drugType} ${kg.toLocaleString("th-TH", { maximumFractionDigits: 2 })} กก.`);
    } else {
      parts.push(item.drugType);
    }
  }
  return parts.join(" • ");
}
