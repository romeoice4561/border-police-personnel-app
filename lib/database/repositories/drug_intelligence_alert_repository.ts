/**
 * DrugIntelligenceAlertRepository (Phase DI-6).
 *
 * Repository-pattern access for persisted alert events. Dedup is enforced
 * via `upsert` keyed on `dedupeKey` (mirrors DrugPersonMatchReviewRepository's
 * upsert-by-composite-unique-key convention for DI-2 exactly) — one
 * meaningful event always produces exactly one row, and re-running
 * generation against unchanged data updates the SAME row's
 * severity/occurrenceCount/lastSeenAt rather than inserting a duplicate.
 * Row status/review fields are NEVER touched by the upsert's `update`
 * clause — only regeneration-derived fields are — so a human's
 * REVIEWED/DISMISSED decision is never silently reset by the next
 * generation pass.
 */

import type { DatabaseClient, DrugIntelligenceAlert } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type {
  DrugAlertType,
  DrugAlertSeverity,
  DrugAlertStatus,
  DrugIntelligenceAlertCandidate,
} from "@/lib/drug_intelligence/drug_intelligence_alert_types";

export interface DrugIntelligenceAlertFilter {
  status?: DrugAlertStatus;
  alertType?: DrugAlertType;
  severity?: DrugAlertSeverity;
  entityType?: string;
  currentCaseId?: string;
}

export class DrugIntelligenceAlertRepository {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Section 11 dedup: insert-or-refresh by dedupeKey. Never touches
   * status/reviewedBy/reviewedByName/reviewedAt/dismissReason on an
   * existing row.
   *
   * `entityId`/`currentCaseId`/`priorCaseIds`/`relatedPersonIds` are
   * explicitly coerced to strings here — the schema column is `String`,
   * but upstream callers may pass whatever id type their source row
   * actually has (e.g. DrugPhoneNumber/DrugDevice/DrugVehicle get
   * NUMERIC autoincrement ids from InMemoryDatabaseClient's test fake,
   * while DrugCase/DrugPerson always get string cuids). Without this
   * coercion, an alert generated from a numeric-id entity would fail
   * every later string-keyed lookup (findForEntity, the Alert Center API,
   * a URL query param round-trip) since `1 !== "1"`.
   */
  async upsertByDedupeKey(candidate: DrugIntelligenceAlertCandidate): Promise<DrugIntelligenceAlert> {
    const entityId = String(candidate.entityId);
    const currentCaseId = candidate.currentCaseId !== null ? String(candidate.currentCaseId) : null;
    const priorCaseIds = candidate.priorCaseIds.map(String);
    const relatedPersonIds = candidate.relatedPersonIds ? candidate.relatedPersonIds.map(String) : null;

    return this.db.drugIntelligenceAlert.upsert({
      where: { dedupeKey: candidate.dedupeKey },
      create: {
        id: generateDrugId(),
        alertType: candidate.alertType,
        severity: candidate.severity,
        entityType: candidate.entityType,
        entityId,
        title: candidate.title,
        explanation: candidate.explanation,
        currentCaseId,
        priorCaseIds,
        relatedPersonIds,
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
        occurrenceCount: candidate.occurrenceCount,
        dedupeKey: candidate.dedupeKey,
        status: "NEW",
      },
      update: {
        severity: candidate.severity,
        title: candidate.title,
        explanation: candidate.explanation,
        priorCaseIds,
        relatedPersonIds,
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
        occurrenceCount: candidate.occurrenceCount,
      },
    });
  }

  async findById(id: string): Promise<DrugIntelligenceAlert | null> {
    return this.db.drugIntelligenceAlert.findUnique({ where: { id } });
  }

  async findByDedupeKey(dedupeKey: string): Promise<DrugIntelligenceAlert | null> {
    return this.db.drugIntelligenceAlert.findUnique({ where: { dedupeKey } });
  }

  /** Read model for the Alert Center + KPI computation — all filtering happens here (server-side), never in the browser (Section 20). */
  async findAll(filter: DrugIntelligenceAlertFilter = {}): Promise<DrugIntelligenceAlert[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.alertType) where.alertType = filter.alertType;
    if (filter.severity) where.severity = filter.severity;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.currentCaseId) where.currentCaseId = filter.currentCaseId;
    return this.db.drugIntelligenceAlert.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  async findForEntity(entityType: string, entityId: string): Promise<DrugIntelligenceAlert[]> {
    return this.db.drugIntelligenceAlert.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
  }

  async findForCase(currentCaseId: string): Promise<DrugIntelligenceAlert[]> {
    return this.db.drugIntelligenceAlert.findMany({ where: { currentCaseId }, orderBy: { createdAt: "desc" } });
  }

  async markReviewed(alertId: string, reviewedBy: string, reviewedByName: string): Promise<DrugIntelligenceAlert> {
    return this.db.drugIntelligenceAlert.update({
      where: { id: alertId },
      data: { status: "REVIEWED", reviewedBy, reviewedByName, reviewedAt: new Date() },
    });
  }

  async markDismissed(alertId: string, reviewedBy: string, reviewedByName: string, dismissReason: string): Promise<DrugIntelligenceAlert> {
    return this.db.drugIntelligenceAlert.update({
      where: { id: alertId },
      data: { status: "DISMISSED", reviewedBy, reviewedByName, reviewedAt: new Date(), dismissReason },
    });
  }

  /** Section 9: reopening a reviewed/dismissed alert back to NEW — never deletes history, only resets lifecycle state. */
  async reopen(alertId: string): Promise<DrugIntelligenceAlert> {
    return this.db.drugIntelligenceAlert.update({
      where: { id: alertId },
      data: { status: "NEW", reviewedBy: null, reviewedByName: null, reviewedAt: null, dismissReason: null },
    });
  }
}
