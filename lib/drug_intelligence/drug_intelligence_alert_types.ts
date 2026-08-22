/**
 * Repeat Entity Detection & Intelligence Alerts — domain types (Phase DI-6).
 *
 * These are ANALYTICAL alert categories, never criminal conclusions. An
 * alert means "this identifier/person has appeared before, or two records
 * newly connect to already-recorded data" — it is a prompt to look closer,
 * never a verdict. Every alert's `title`/`explanation` routes through
 * neutral wording (see drug_intelligence_alert_explanation.ts) — never
 * "same network," "owner of," or "co-conspirator."
 *
 * Framework-agnostic: no React, no Next.js Request/Response, no Prisma
 * import here — mirrors drug_network_graph_types.ts's role for DI-5.
 */

export type DrugAlertType =
  | "REPEAT_PERSON"
  | "REPEAT_PHONE"
  | "REPEAT_SIM"
  | "REPEAT_DEVICE"
  | "REPEAT_VEHICLE"
  | "REPEAT_CASE_ENTITY"
  | "NEW_NETWORK_CONNECTION"
  | "HIGH_CONFIDENCE_DUPLICATE";

export type DrugAlertSeverity = "INFO" | "NOTICE" | "HIGH";

export type DrugAlertEntityType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE";

export type DrugAlertStatus = "NEW" | "REVIEWED" | "DISMISSED";

/**
 * One persisted alert event. Field names intentionally mirror the shape
 * given in the DI-6 spec. `priorCaseIds` never includes `currentCaseId`
 * (Section 2: caller can always tell "this case" from "other cases" without
 * cross-referencing). `occurrenceCount` is always deterministic — see
 * drug_intelligence_alert_service.ts's severity rules for exactly how it's
 * derived per alertType, never invented/estimated.
 */
export interface DrugIntelligenceAlertRecord {
  id: string;
  alertType: DrugAlertType;
  severity: DrugAlertSeverity;
  entityType: DrugAlertEntityType;
  entityId: string;
  title: string;
  explanation: string;
  currentCaseId: string | null;
  priorCaseIds: string[];
  relatedPersonIds: string[] | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  occurrenceCount: number;
  dedupeKey: string;
  status: DrugAlertStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  dismissReason: string | null;
  createdAt: Date;
}

/** A newly-computed alert candidate, before it's persisted/deduplicated against existing rows — everything EXCEPT id/status/review fields/createdAt, which the repository/service assigns. */
export interface DrugIntelligenceAlertCandidate {
  alertType: DrugAlertType;
  severity: DrugAlertSeverity;
  entityType: DrugAlertEntityType;
  entityId: string;
  title: string;
  explanation: string;
  currentCaseId: string | null;
  priorCaseIds: string[];
  relatedPersonIds: string[] | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  occurrenceCount: number;
  dedupeKey: string;
}

export interface DrugIntelligenceAlertListQuery {
  status?: DrugAlertStatus;
  alertType?: DrugAlertType;
  severity?: DrugAlertSeverity;
  entityType?: DrugAlertEntityType;
  currentCaseId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Free-text: case number, person name, or normalized entity value — resolved server-side, never client-side filtering (Section 20). */
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface DrugIntelligenceAlertListResult {
  alerts: DrugIntelligenceAlertRecord[];
  totalCount: number;
  kpi: DrugIntelligenceAlertKpi;
}

/** Alert Center KPI row (Section 8) — always computed from the SAME query scope as the list (never a separate unscoped count), so the numbers on the cards always match what filtering to them would show. */
export interface DrugIntelligenceAlertKpi {
  unreviewed: number;
  highSeverity: number;
  repeatPerson: number;
  repeatPhoneOrSim: number;
  repeatDeviceOrImei: number;
  repeatVehicle: number;
}

export interface DrugIntelligenceAlertReviewInput {
  alertId: string;
  actorId: string;
  actorName: string;
}

export interface DrugIntelligenceAlertDismissInput {
  alertId: string;
  actorId: string;
  actorName: string;
  reason: string;
}

export class DrugIntelligenceAlertNotFoundError extends Error {
  constructor(alertId: string) {
    super(`Drug intelligence alert '${alertId}' not found`);
    this.name = "DrugIntelligenceAlertNotFoundError";
  }
}
