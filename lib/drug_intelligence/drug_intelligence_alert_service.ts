/**
 * DrugIntelligenceAlertService (Phase DI-6).
 *
 * Generates and persists intelligence alerts by calling EXISTING services —
 * DrugCaseService.getCase, DrugEntityDetailService, DrugPersonProfileService,
 * DrugPersonMatchingService — never re-implementing phone/IMEI/vehicle/
 * person matching. This module's only job is: read what those services
 * already know, decide severity (drug_intelligence_alert_severity.ts),
 * compose neutral wording (drug_intelligence_alert_explanation.ts), and
 * persist via DrugIntelligenceAlertRepository's upsert-by-dedupeKey.
 *
 * Section 23 performance constraint: alert generation is always scoped to
 * ONE just-created/just-updated case (bounded — the case's own person/
 * phone/sim/device/vehicle count, never the whole database) and, for the
 * one HIGH_CONFIDENCE_DUPLICATE check per NEW person, DrugPersonMatchingService
 * .findCandidates(identity, excludePersonId) — a TARGETED single-person
 * scan, never findUnresolvedPairs()'s O(n²) whole-pool sweep. No global
 * "compare everything to everything" pass exists anywhere in this file.
 *
 * Called AFTER DrugCaseService.createCase() commits (never inside that
 * transaction) — alert generation is intelligence assistance, not a
 * data-integrity requirement; a failure here must never roll back or block
 * a successful case save (Section 4/6).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugEntityDetailService } from "@/lib/drug_intelligence/drug_entity_detail_service";
import { DrugPersonProfileService } from "@/lib/drug_intelligence/drug_person_profile_service";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugIntelligenceAlertRepository } from "@/lib/database/repositories/drug_intelligence_alert_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";
import {
  deriveRepeatEntitySeverity,
  deriveRepeatPersonSeverity,
  deriveHighConfidenceDuplicateSeverity,
  deriveNewNetworkConnectionSeverity,
} from "@/lib/drug_intelligence/drug_intelligence_alert_severity";
import { composeDrugAlertTitle, composeDrugAlertExplanation } from "@/lib/drug_intelligence/drug_intelligence_alert_explanation";
import { computeDrugAlertDedupeKey, orderDrugDuplicatePair } from "@/lib/drug_intelligence/drug_intelligence_alert_dedupe";
import type { DrugIntelligenceAlertFilter } from "@/lib/database/repositories/drug_intelligence_alert_repository";
import { DrugIntelligenceAlertNotFoundError, type DrugAlertEntityType, type DrugIntelligenceAlertRecord } from "@/lib/drug_intelligence/drug_intelligence_alert_types";

function toAlertRecord(row: {
  id: string;
  alertType: string;
  severity: string;
  entityType: string;
  entityId: string;
  title: string;
  explanation: string;
  currentCaseId: string | null;
  priorCaseIds: unknown;
  relatedPersonIds: unknown;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  occurrenceCount: number;
  dedupeKey: string;
  status: string;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  dismissReason: string | null;
  createdAt: Date;
}): DrugIntelligenceAlertRecord {
  return {
    ...row,
    alertType: row.alertType as DrugIntelligenceAlertRecord["alertType"],
    severity: row.severity as DrugIntelligenceAlertRecord["severity"],
    entityType: row.entityType as DrugAlertEntityType,
    status: row.status as DrugIntelligenceAlertRecord["status"],
    priorCaseIds: (row.priorCaseIds as string[] | null) ?? [],
    relatedPersonIds: (row.relatedPersonIds as string[] | null) ?? null,
  };
}

/** Section 8's KPI cards — always derived from the SAME alert list passed in, never a separate unscoped query. */
function computeKpi(alerts: DrugIntelligenceAlertRecord[]) {
  return {
    unreviewed: alerts.filter((a) => a.status === "NEW").length,
    highSeverity: alerts.filter((a) => a.severity === "HIGH").length,
    repeatPerson: alerts.filter((a) => a.alertType === "REPEAT_PERSON" || a.alertType === "HIGH_CONFIDENCE_DUPLICATE").length,
    repeatPhoneOrSim: alerts.filter((a) => a.alertType === "REPEAT_PHONE" || a.alertType === "REPEAT_SIM").length,
    repeatDeviceOrImei: alerts.filter((a) => a.alertType === "REPEAT_DEVICE").length,
    repeatVehicle: alerts.filter((a) => a.alertType === "REPEAT_VEHICLE").length,
  };
}

/** Section 4's real-time inline intelligence card — existence-only lookup enriched with case/person counts. Never persists an alert row (alerts are only ever generated at case-creation time via generateAlertsForCase); this is purely a read for the Create Case wizard's debounced check. */
export interface DrugAlertQuickCheckResult {
  found: boolean;
  entityType: DrugAlertEntityType;
  entityId: string | null;
  caseCount: number;
  relatedPersonCount: number;
  lastSeenAt: Date | null;
}

const NOT_FOUND_QUICK_CHECK = (entityType: DrugAlertEntityType): DrugAlertQuickCheckResult => ({ found: false, entityType, entityId: null, caseCount: 0, relatedPersonCount: 0, lastSeenAt: null });

export class DrugIntelligenceAlertService {
  private readonly alertRepo: DrugIntelligenceAlertRepository;
  private readonly caseService: DrugCaseService;
  private readonly entityDetailService: DrugEntityDetailService;
  private readonly entityRepo: DrugEntityRepository;
  private readonly personProfileService: DrugPersonProfileService;
  private readonly matchingService: DrugPersonMatchingService;
  private readonly auditRepo: DrugAuditLogRepository;

  constructor(private readonly db: DatabaseClient) {
    this.alertRepo = new DrugIntelligenceAlertRepository(db);
    this.caseService = new DrugCaseService({ db });
    this.entityDetailService = new DrugEntityDetailService(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.personProfileService = new DrugPersonProfileService(db);
    this.matchingService = new DrugPersonMatchingService(db);
    this.auditRepo = new DrugAuditLogRepository(db);
  }

  /** Section 4: real-time phone-reuse signal — enriches the existing existence-only check with case/person counts and last-seen date. */
  async quickCheckPhone(rawInput: string): Promise<DrugAlertQuickCheckResult> {
    const normalizedNumber = normalizePhoneMatchingKey(rawInput);
    if (!normalizedNumber) return NOT_FOUND_QUICK_CHECK("PHONE");
    const phone = await this.entityRepo.findPhoneNumberByNormalized(normalizedNumber);
    if (!phone) return NOT_FOUND_QUICK_CHECK("PHONE");
    const detail = await this.entityDetailService.getPhoneDetail(phone.id);
    return { found: true, entityType: "PHONE", entityId: phone.id, caseCount: detail.caseCount, relatedPersonCount: detail.relatedPersonCount, lastSeenAt: detail.lastSeenAt };
  }

  /** Section 4: real-time IMEI/device-reuse signal. */
  async quickCheckDevice(imei1: string | null, serialNumber: string | null): Promise<DrugAlertQuickCheckResult> {
    const device = await this.entityRepo.findDeviceByImeiOrSerial(imei1, serialNumber);
    if (!device) return NOT_FOUND_QUICK_CHECK("DEVICE");
    const detail = await this.entityDetailService.getDeviceDetail(device.id);
    return { found: true, entityType: "DEVICE", entityId: device.id, caseCount: detail.caseCount, relatedPersonCount: detail.relatedPersonCount, lastSeenAt: detail.lastSeenAt };
  }

  /** Section 4: real-time vehicle-reuse signal. */
  async quickCheckVehicle(registrationNumber: string | null, registrationProvince: string | null, vin: string | null): Promise<DrugAlertQuickCheckResult> {
    const vehicle = await this.entityRepo.findVehicleByRegistrationOrVin(registrationNumber, registrationProvince, vin);
    if (!vehicle) return NOT_FOUND_QUICK_CHECK("VEHICLE");
    const detail = await this.entityDetailService.getVehicleDetail(vehicle.id);
    return { found: true, entityType: "VEHICLE", entityId: vehicle.id, caseCount: detail.caseCount, relatedPersonCount: detail.relatedPersonCount, lastSeenAt: detail.lastSeenAt };
  }

  /**
   * Section 4/6/7: the core generation entry point. Scoped entirely to one
   * case's own persons/phones/sims/devices/vehicles — bounded work, never a
   * whole-database scan. Returns the alerts generated/refreshed (for the
   * post-create summary — Section 7), and persists every one.
   */
  async generateAlertsForCase(caseId: string, actorId: string, actorName: string): Promise<DrugIntelligenceAlertRecord[]> {
    const caseDetail = await this.caseService.getCase(caseId);
    const generated: DrugIntelligenceAlertRecord[] = [];

    // REPEAT_PHONE (+ NEW_NETWORK_CONNECTION when the ONLY signal is
    // multiple distinct persons sharing the entity within THIS case, with
    // no prior case at all — e.g. the DI-5.2 QA fixture's Person A + B
    // sharing phone 080-000-0001 inside the same case, QA-001. This is a
    // real, previously-unwired gap: a phone/device/vehicle newly linking
    // two people in the SAME submission is exactly the "ข้อมูลใหม่ทำให้
    // เกิดความเชื่อมโยงกับเครือข่ายเดิม" signal the DI-6 spec names, distinct
    // from REPEAT_* (which requires the entity to have appeared in
    // ANOTHER case before). Both checks reuse the SAME already-fetched
    // `detail` — no extra query.)
    const phoneIds = new Set(caseDetail.phones.map((p) => p.phoneNumberId));
    for (const phoneNumberId of phoneIds) {
      const detail = await this.entityDetailService.getPhoneDetail(phoneNumberId);
      const priorCaseIds = detail.sourceCases.map((c) => c.id).filter((id) => id !== caseId);
      if (priorCaseIds.length > 0) {
        const record = await this.upsertEntityAlert("REPEAT_PHONE", "PHONE", phoneNumberId, caseId, priorCaseIds, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      } else if (detail.relatedPersons.length >= 2) {
        const record = await this.upsertNewNetworkConnectionAlert("PHONE", phoneNumberId, caseId, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      }
    }

    // REPEAT_SIM (+ NEW_NETWORK_CONNECTION, same rule as phone above)
    const simIds = new Set(caseDetail.sims.map((s) => s.simId));
    for (const simId of simIds) {
      const detail = await this.entityDetailService.getSimDetail(simId);
      const priorCaseIds = detail.sourceCases.map((c) => c.id).filter((id) => id !== caseId);
      if (priorCaseIds.length > 0) {
        const record = await this.upsertEntityAlert("REPEAT_SIM", "SIM", simId, caseId, priorCaseIds, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      } else if (detail.relatedPersons.length >= 2) {
        const record = await this.upsertNewNetworkConnectionAlert("SIM", simId, caseId, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      }
    }

    // REPEAT_DEVICE (+ NEW_NETWORK_CONNECTION, same rule — e.g. Person B + C sharing IMEI 990000000000002)
    const deviceIds = new Set(caseDetail.devices.map((d) => d.deviceId));
    for (const deviceId of deviceIds) {
      const detail = await this.entityDetailService.getDeviceDetail(deviceId);
      const priorCaseIds = detail.sourceCases.map((c) => c.id).filter((id) => id !== caseId);
      if (priorCaseIds.length > 0) {
        const record = await this.upsertEntityAlert("REPEAT_DEVICE", "DEVICE", deviceId, caseId, priorCaseIds, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      } else if (detail.relatedPersons.length >= 2) {
        const record = await this.upsertNewNetworkConnectionAlert("DEVICE", deviceId, caseId, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      }
    }

    // REPEAT_VEHICLE (+ NEW_NETWORK_CONNECTION, same rule — e.g. Person A + D sharing QA-1001)
    const vehicleIds = new Set(caseDetail.vehicles.map((v) => v.vehicleId));
    for (const vehicleId of vehicleIds) {
      const detail = await this.entityDetailService.getVehicleDetail(vehicleId);
      const priorCaseIds = detail.sourceCases.map((c) => c.id).filter((id) => id !== caseId);
      if (priorCaseIds.length > 0) {
        const record = await this.upsertEntityAlert("REPEAT_VEHICLE", "VEHICLE", vehicleId, caseId, priorCaseIds, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      } else if (detail.relatedPersons.length >= 2) {
        const record = await this.upsertNewNetworkConnectionAlert("VEHICLE", vehicleId, caseId, detail.relatedPersons.map((p) => p.id), detail.firstSeenAt, detail.lastSeenAt);
        generated.push(record);
      }
    }

    // REPEAT_PERSON + HIGH_CONFIDENCE_DUPLICATE — one pass per distinct person on this case.
    const personIds = new Set(caseDetail.persons.map((p) => p.personId));
    for (const personId of personIds) {
      const profile = await this.personProfileService.getProfile(personId);
      const priorCaseIds = profile.cases.map((c) => c.caseId).filter((id) => id !== caseId);
      if (priorCaseIds.length > 0) {
        const record = await this.upsertRepeatPersonAlert(personId, caseId, priorCaseIds, profile.firstSeenAt, profile.lastSeenAt, profile.cases.length);
        generated.push(record);
      }

      // Targeted single-person duplicate scan (Section 23: never the
      // O(n²) findUnresolvedPairs() sweep) — only ever a HIGH-confidence
      // candidate becomes an alert; MEDIUM/LOW stay in the existing
      // Duplicate Review Queue, never duplicated into this alert stream.
      const identity = await this.matchingService.buildIdentityForPerson(personId);
      if (identity) {
        const candidates = await this.matchingService.findCandidates(identity, personId);
        for (const candidate of candidates) {
          if (candidate.confidence !== "HIGH") continue;
          if (candidate.existingDecision) continue; // Section 19: an already-reviewed pair is never re-surfaced as a fresh alert.
          const record = await this.upsertDuplicatePairAlert(personId, candidate.personId);
          generated.push(record);
        }
      }
    }

    for (const record of generated) {
      await this.auditRepo.record({
        entityType: "DrugIntelligenceAlert",
        entityId: record.id,
        action: "alert_generated",
        actorId,
        actorName,
        detail: `alertType=${record.alertType} entityType=${record.entityType} entityId=${record.entityId} case=${caseId}`,
      });
    }

    return generated;
  }

  /** Alert Center read model (Section 8/20): list + KPI, both computed from the SAME filtered scope so the KPI cards always agree with what the list would show if you filtered to them. */
  async listAlerts(filter: DrugIntelligenceAlertFilter): Promise<{ alerts: DrugIntelligenceAlertRecord[]; kpi: ReturnType<typeof computeKpi> }> {
    const rows = await this.alertRepo.findAll(filter);
    const alerts = rows.map(toAlertRecord);
    return { alerts, kpi: computeKpi(alerts) };
  }

  async getAlertsForEntity(entityType: string, entityId: string): Promise<DrugIntelligenceAlertRecord[]> {
    const rows = await this.alertRepo.findForEntity(entityType, entityId);
    return rows.map(toAlertRecord);
  }

  async getAlertsForCase(caseId: string): Promise<DrugIntelligenceAlertRecord[]> {
    const rows = await this.alertRepo.findForCase(caseId);
    return rows.map(toAlertRecord);
  }

  async reviewAlert(alertId: string, actorId: string, actorName: string): Promise<DrugIntelligenceAlertRecord> {
    await this.assertAlertExists(alertId);
    const row = await this.alertRepo.markReviewed(alertId, actorId, actorName);
    await this.auditRepo.record({ entityType: "DrugIntelligenceAlert", entityId: alertId, action: "alert_reviewed", actorId, actorName, detail: null });
    return toAlertRecord(row);
  }

  async dismissAlert(alertId: string, actorId: string, actorName: string, reason: string): Promise<DrugIntelligenceAlertRecord> {
    await this.assertAlertExists(alertId);
    const row = await this.alertRepo.markDismissed(alertId, actorId, actorName, reason);
    await this.auditRepo.record({ entityType: "DrugIntelligenceAlert", entityId: alertId, action: "alert_dismissed", actorId, actorName, detail: reason });
    return toAlertRecord(row);
  }

  async reopenAlert(alertId: string, actorId: string, actorName: string): Promise<DrugIntelligenceAlertRecord> {
    await this.assertAlertExists(alertId);
    const row = await this.alertRepo.reopen(alertId);
    await this.auditRepo.record({ entityType: "DrugIntelligenceAlert", entityId: alertId, action: "alert_reopened", actorId, actorName, detail: null });
    return toAlertRecord(row);
  }

  private async assertAlertExists(alertId: string): Promise<void> {
    const existing = await this.alertRepo.findById(alertId);
    if (!existing) throw new DrugIntelligenceAlertNotFoundError(alertId);
  }

  private async upsertEntityAlert(
    alertType: "REPEAT_PHONE" | "REPEAT_SIM" | "REPEAT_DEVICE" | "REPEAT_VEHICLE",
    entityType: DrugAlertEntityType,
    entityId: string,
    currentCaseId: string,
    priorCaseIds: string[],
    relatedPersonIds: string[],
    firstSeenAt: Date | null,
    lastSeenAt: Date | null
  ): Promise<DrugIntelligenceAlertRecord> {
    const severity = deriveRepeatEntitySeverity(priorCaseIds.length, relatedPersonIds.length);
    const explanationInput = { alertType, entityType, priorCaseCount: priorCaseIds.length, relatedPersonCount: relatedPersonIds.length };
    const row = await this.alertRepo.upsertByDedupeKey({
      alertType,
      severity,
      entityType,
      entityId,
      title: composeDrugAlertTitle(explanationInput),
      explanation: composeDrugAlertExplanation(explanationInput),
      currentCaseId,
      priorCaseIds,
      relatedPersonIds,
      firstSeenAt,
      lastSeenAt,
      occurrenceCount: priorCaseIds.length + 1,
      dedupeKey: computeDrugAlertDedupeKey({ alertType, entityType, entityId, currentCaseId }),
    });
    return toAlertRecord(row);
  }

  /**
   * NEW_NETWORK_CONNECTION: an entity newly links 2+ distinct persons
   * WITHIN the current case's own submission, with no prior case at all
   * (if it had a prior case, upsertEntityAlert's REPEAT_* path already
   * covers it — the two are mutually exclusive per call site). This is
   * the "ข้อมูลใหม่ทำให้เกิดความเชื่อมโยงกับเครือข่ายเดิม" signal — e.g. two
   * persons on the same case both reporting the same phone number.
   */
  private async upsertNewNetworkConnectionAlert(
    entityType: DrugAlertEntityType,
    entityId: string,
    currentCaseId: string,
    relatedPersonIds: string[],
    firstSeenAt: Date | null,
    lastSeenAt: Date | null
  ): Promise<DrugIntelligenceAlertRecord> {
    const severity = deriveNewNetworkConnectionSeverity();
    const explanationInput = { alertType: "NEW_NETWORK_CONNECTION" as const, entityType, priorCaseCount: 0, relatedPersonCount: relatedPersonIds.length };
    const row = await this.alertRepo.upsertByDedupeKey({
      alertType: "NEW_NETWORK_CONNECTION",
      severity,
      entityType,
      entityId,
      title: composeDrugAlertTitle(explanationInput),
      explanation: composeDrugAlertExplanation(explanationInput),
      currentCaseId,
      priorCaseIds: [],
      relatedPersonIds,
      firstSeenAt,
      lastSeenAt,
      occurrenceCount: 1,
      dedupeKey: computeDrugAlertDedupeKey({ alertType: "NEW_NETWORK_CONNECTION", entityType, entityId, currentCaseId }),
    });
    return toAlertRecord(row);
  }

  private async upsertRepeatPersonAlert(
    personId: string,
    currentCaseId: string,
    priorCaseIds: string[],
    firstSeenAt: Date | null,
    lastSeenAt: Date | null,
    totalCaseCount: number
  ): Promise<DrugIntelligenceAlertRecord> {
    const severity = deriveRepeatPersonSeverity(totalCaseCount);
    const explanationInput = { alertType: "REPEAT_PERSON" as const, entityType: "PERSON" as const, priorCaseCount: priorCaseIds.length, relatedPersonCount: 0 };
    const row = await this.alertRepo.upsertByDedupeKey({
      alertType: "REPEAT_PERSON",
      severity,
      entityType: "PERSON",
      entityId: personId,
      title: composeDrugAlertTitle(explanationInput),
      explanation: composeDrugAlertExplanation(explanationInput),
      currentCaseId,
      priorCaseIds,
      relatedPersonIds: null,
      firstSeenAt,
      lastSeenAt,
      occurrenceCount: totalCaseCount,
      dedupeKey: computeDrugAlertDedupeKey({ alertType: "REPEAT_PERSON", entityType: "PERSON", entityId: personId, currentCaseId }),
    });
    return toAlertRecord(row);
  }

  private async upsertDuplicatePairAlert(personIdA: string, personIdB: string): Promise<DrugIntelligenceAlertRecord> {
    const [orderedA, orderedB] = orderDrugDuplicatePair(personIdA, personIdB);
    const severity = deriveHighConfidenceDuplicateSeverity();
    const explanationInput = { alertType: "HIGH_CONFIDENCE_DUPLICATE" as const, entityType: "PERSON" as const, priorCaseCount: 0, relatedPersonCount: 1 };
    const dedupeKey = `HIGH_CONFIDENCE_DUPLICATE:PERSON:${orderedA}:${orderedB}`;
    const row = await this.alertRepo.upsertByDedupeKey({
      alertType: "HIGH_CONFIDENCE_DUPLICATE",
      severity,
      entityType: "PERSON",
      entityId: orderedA,
      title: composeDrugAlertTitle(explanationInput),
      explanation: composeDrugAlertExplanation(explanationInput),
      currentCaseId: null,
      priorCaseIds: [],
      relatedPersonIds: [orderedB],
      firstSeenAt: null,
      lastSeenAt: null,
      occurrenceCount: 1,
      dedupeKey,
    });
    return toAlertRecord(row);
  }
}
