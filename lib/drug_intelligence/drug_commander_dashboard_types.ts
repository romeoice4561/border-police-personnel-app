/**
 * Commander Intelligence Dashboard types (Phase 2B).
 *
 * All TypeScript interfaces for the Commander Dashboard API responses.
 * Shared between the service, API handlers, client, and hooks.
 *
 * Seizure aggregation rules (NON-NEGOTIABLE):
 * - COUNT rows: totalQuantity (from quantity field)
 * - MASS rows: totalWeightKg (from weightGrams / 1000)
 * - COUNT and MASS are NEVER added together
 * - Different drug categories are NEVER added together
 *
 * Pure types — no I/O, no React.
 */

// ── Overview ─────────────────────────────────────────────────────────────

/** Top-level KPI counts for the commander dashboard header row. */
export interface CommanderOverviewData {
  caseCount: number;
  /** Unique persons with role ARRESTED_PERSON or ACCUSED across matching cases. */
  arrestedPersonCount: number;
  /** Cases in this period with no ARRESTED_PERSON/ACCUSED case-person link. */
  casesWithoutArrestedRoleCount: number;
  /** DrugIntelligenceAlerts with status NEW (global — not date-bounded). */
  newAlertsCount: number;
  /** HIGH_CONFIDENCE_DUPLICATE alerts with status NEW (global). */
  pendingDuplicatesCount: number;
  /** Filter metadata echoed back to the client. */
  filter: CommanderFilterMeta;
  generatedAt: string;
}

/** Serialized filter metadata returned in responses (dates as ISO strings). */
export interface CommanderFilterMeta {
  arrestDateFrom: string;
  arrestDateTo: string;
  fiscalYear?: number;
  fiscalYearBe?: number;
  displayFiscalYearTh?: string;
  reportingHeadquartersId?: number;
  reportingRegionId?: number;
  reportingBattalionId?: number;
  reportingCompanyId?: number;
  province?: string;
  status?: string;
}

// ── Seizures ─────────────────────────────────────────────────────────────

/** Aggregated seizure line for one (drugCategory, measurementKind) combination. */
export interface CommanderSeizureItem {
  drugCategory: string;
  labelTh: string;
  /** "COUNT" or "MASS" — NEVER mixed on one item. */
  measurementKind: string;
  /** Total quantity for COUNT rows (null for MASS rows). */
  totalQuantity: number | null;
  /** Total weight in grams for MASS rows (null for COUNT rows). */
  totalWeightGrams: number | null;
  /** totalWeightGrams / 1000, for display (null for COUNT rows). */
  totalWeightKg: number | null;
  /** Display unit string (e.g. "เม็ด", "แท่ง") for COUNT rows; null for MASS. */
  displayUnit: string | null;
}

export interface CommanderSeizuresData {
  items: CommanderSeizureItem[];
  filter: CommanderFilterMeta;
  generatedAt: string;
}

// ── Trend ─────────────────────────────────────────────────────────────────

/** One calendar month bucket for the trend chart. */
export interface CommanderTrendBucket {
  /** "YYYY-MM" — sortable key. */
  monthKey: string;
  month: number;
  year: number;
  caseCount: number;
}

export interface CommanderTrendData {
  buckets: CommanderTrendBucket[];
  totalCases: number;
  filter: CommanderFilterMeta;
  generatedAt: string;
}

// ── Areas ─────────────────────────────────────────────────────────────────

/** Province ranked by case count. */
export interface CommanderAreaRow {
  province: string;
  caseCount: number;
}

export interface CommanderAreasData {
  rows: CommanderAreaRow[];
  filter: CommanderFilterMeta;
  generatedAt: string;
}

// ── Units ─────────────────────────────────────────────────────────────────

/** Unit performance row — multiple dimensions shown, not a combined score. */
export interface CommanderUnitRow {
  /** Battalion or company id (null for records without an org id). */
  unitId: number | null;
  unitLabel: string;
  caseCount: number;
  /** Unique arrested persons (ARRESTED_PERSON + ACCUSED) in this unit's cases. */
  arrestedPersonCount: number;
  /** Total methamphetamine tablet count (COUNT measurementKind). */
  methTabletCount: number | null;
  /** Total crystal meth weight in kg (MASS measurementKind → weightGrams / 1000). */
  iceCrystalKg: number | null;
}

export interface CommanderUnitsData {
  rows: CommanderUnitRow[];
  /** The org level being shown ("region" | "battalion" | "company"). */
  groupBy: string;
  /** Cases in scope that have a reporting-unit id at the ranking level. */
  assignedCaseCount: number;
  /** Cases in scope whose ranking-level reporting-unit id is null. */
  unassignedCaseCount: number;
  filter: CommanderFilterMeta;
  generatedAt: string;
}

// ── Signals ──────────────────────────────────────────────────────────────

/** Count of NEW alerts per alertType. */
export interface CommanderSignalCount {
  alertType: string;
  count: number;
}

/** Serialized alert for the "top signals" list. */
export interface CommanderSignalAlert {
  id: string;
  alertType: string;
  severity: string;
  entityType: string;
  entityId: string;
  title: string;
  occurrenceCount: number;
  createdAt: string;
}

export interface CommanderSignalsData {
  /** Count per alertType (REPEAT_PERSON / REPEAT_PHONE / REPEAT_SIM / REPEAT_DEVICE / REPEAT_VEHICLE). */
  signalCounts: CommanderSignalCount[];
  /** Up to 5 most recent NEW alerts for the dashboard summary. */
  topSignals: CommanderSignalAlert[];
  /** Total new alerts count. */
  totalNewAlerts: number;
  generatedAt: string;
}
